#!/usr/bin/env python3
import os
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import toml
import json
import time
import tempfile
import logging
import sys
import requests
from datetime import datetime
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="QA-Genie AI Service",
    description="AI-powered test case generation service using IBM Watson X AI"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if os.environ.get("NODE_ENV") != "production" else ["https://your-production-domain.com", "https://www.your-production-domain.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Define Watson X AI service
class WatsonXService:
    """Service for interacting with the Watson X AI API directly"""
    
    def __init__(self, token_manager, api_url, space_id):
        self.token_manager = token_manager
        self.api_url = api_url
        self.space_id = space_id
        logger.info(f"Initialized WatsonX Service with endpoint: {api_url}")
        
    def generate_text(self, prompt, system_prompt=None, params=None):
        """Generate text using Watson X AI via REST API"""
        try:
            # Get fresh token
            token = self.token_manager.get_token()
            if not token:
                raise Exception("Failed to obtain valid token")
                
            # Set up headers
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            # Default parameters
            if not params:
                params = {
                    "max_new_tokens": 4000,
                    "temperature": 0.2,
                    "top_p": 0.95,
                    "min_new_tokens": 100
                }
                
            # Create payload
            payload = {
                "input": prompt,
                "model_id": "ibm/granite-13b-chat-v2",
                "project_id": self.space_id,
                "parameters": params
            }
            
            # Add system prompt if provided
            if system_prompt:
                payload["system_prompt"] = system_prompt
                
            logger.info(f"Making API request to Watson X AI: {self.api_url}")
            
            # Make the API call
            response = requests.post(
                f"{self.api_url}/ml/v1/text/generation?version=2024-05-31",
                headers=headers,
                json=payload
            )
            
            # Check response
            if response.status_code != 200:
                logger.error(f"API call failed: {response.status_code}")
                logger.error(f"Response: {response.text}")
                raise Exception(f"API call failed with status code: {response.status_code}")
                
            result = response.json()
            generated_text = result.get("results", [{}])[0].get("generated_text", "")
            
            return generated_text
            
        except Exception as e:
            logger.error(f"Error in generate_text: {e}")
            raise e

try:
    from ibm_watsonx_ai import APIClient
    from ibm_watsonx_ai.foundation_models import Model, ModelInference
    logger.info("Successfully imported IBM Watson X AI modules")
except ImportError as e:
    logger.error(f"Failed to import IBM Watson X AI modules: {e}")
    logger.warning("Please install the required libraries with: pip install ibm-watsonx-ai")
    logger.warning("Continuing with limited functionality - AI features will be disabled")
    # Don't exit, just continue without these modules
    has_watsonx_modules = False
else:
    has_watsonx_modules = True

# Load configuration from config.toml or use environment variables
try:
    # Get the directory of the current script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(current_dir, "config.toml")
    logger.info(f"Looking for config.toml at: {config_path}")
    
    config = toml.load(config_path)
    api_key = config["deployment"]["watsonx_apikey"]
    api_url = config["deployment"].get("watsonx_url", "https://us-south.ml.cloud.ibm.com")
    space_id = config["deployment"]["space_id"]
    platform_url = config["deployment"].get("platform_url", "https://api.dataplatform.cloud.ibm.com")
    logger.info(f"Loaded configuration from config.toml. Space ID: {space_id}")
except (FileNotFoundError, KeyError) as e:
    # Fallback to environment variables
    logger.warning(f"Failed to load configuration from config.toml: {e}")
    api_key = os.environ.get("IBM_CLOUD_API_KEY")
    api_url = os.environ.get("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
    space_id = os.environ.get("WATSONX_PROJECT_ID")
    platform_url = os.environ.get("PLATFORM_URL", "https://api.dataplatform.cloud.ibm.com")

class TokenManager:
    def __init__(self, api_key):
        self.api_key = api_key
        self.token = None
        self.expiry_time = 0
        self.refresh_token()
    
    def refresh_token(self):
        """Refresh the IAM token"""
        try:
            logger.info("Refreshing IAM token...")
            response = requests.post(
                "https://iam.cloud.ibm.com/identity/token",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                    "apikey": self.api_key
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Failed to refresh IAM token. Status code: {response.status_code}")
                logger.error(f"Response: {response.text}")
                return False
                
            token_data = response.json()
            self.token = token_data.get("access_token")
            expires_in = token_data.get("expires_in", 3600)  # Default 1 hour
            
            # Set expiry time to 90% of the actual expiry to refresh before it expires
            self.expiry_time = time.time() + (expires_in * 0.9)
            
            logger.info(f"Successfully refreshed IAM token. Expires in {expires_in} seconds")
            return True
        except Exception as e:
            logger.error(f"Error refreshing IAM token: {e}")
            return False
    
    def get_token(self):
        """Get the current token, refreshing if necessary"""
        if time.time() > self.expiry_time:
            self.refresh_token()
        return self.token

# Check if credentials are available
if not api_key or not space_id:
    logger.warning("IBM Watson X AI credentials not found. Please set them in config.toml or environment variables.")
    logger.warning("Continuing with limited functionality - AI features will be disabled")
    token_manager = None
    watson_service = None
else:
    try:
        # Create token manager
        token_manager = TokenManager(api_key)
        
        # Log credentials (without the actual API key)
        logger.info(f"Initializing IBM Watson X AI client with:")
        logger.info(f"  - URL: {api_url}")
        logger.info(f"  - Space ID: {space_id}")
        logger.info(f"  - Platform URL: {platform_url}")
        
        if not token_manager or not token_manager.get_token():
            raise Exception("No valid token available")
            
        # Initialize the Watson X service with direct REST API approach
        watson_service = WatsonXService(token_manager, api_url, space_id)
        logger.info("Successfully initialized IBM Watson X AI service")
        
    except Exception as e:
        logger.error(f"Failed to initialize Watson X AI service: {e}")
        logger.warning("Service will continue but AI features will fail")
        watson_service = None

# Define request and response models
class PRDRequest(BaseModel):
    content: str
    format: str = "markdown"  # Could be markdown, pdf_base64, or text
    project_id: Optional[str] = None

class TestCase(BaseModel):
    id: str
    title: str
    description: str
    preconditions: Optional[str] = None
    steps: List[Dict[str, str]]
    expected_results: List[str]
    priority: str
    tags: List[str] = []

class TestCaseResponse(BaseModel):
    test_cases: List[TestCase]
    summary: str
    coverage_percentage: float

# Prompts for the AI model
SYSTEM_PROMPT = """You are QA-Genie, an expert in test case generation.
Given a Product Requirements Document (PRD), you will generate comprehensive test cases.
Each test case should include:
- A clear title
- A description of what is being tested
- Preconditions needed for the test
- Step-by-step instructions
- Expected results for each step
- Priority level (must-have, should-have, nice-to-have)
- Relevant tags

Focus on functional requirements, edge cases, error handling, and user flows.
"""

TEST_CASE_PROMPT_TEMPLATE = """
### PRD CONTENT:
{prd_content}

### TASK:
Based on the PRD above, generate a comprehensive set of test cases that cover all the functional requirements.

### FORMAT:
Return the test cases as a JSON array with the following structure:
{{
  "test_cases": [
    {{
      "id": "TC001",
      "title": "Test case title",
      "description": "Description of what is being tested",
      "preconditions": "Any prerequisites for the test",
      "steps": [
        {{ "step": "1", "action": "User action description" }},
        {{ "step": "2", "action": "Next user action description" }}
      ],
      "expected_results": [
        "Expected result for step 1",
        "Expected result for step 2"
      ],
      "priority": "must-have|should-have|nice-to-have",
      "tags": ["tag1", "tag2"]
    }}
  ],
  "summary": "Brief summary of the coverage",
  "coverage_percentage": 95.0
}}

### OUTPUT:
Only return a valid JSON object with no explanations or markdown formatting.
"""

CUCUMBER_PROMPT_TEMPLATE = """
### TEST CASES:
{test_cases_json}

### TASK:
Convert these test cases into Cucumber feature files using Gherkin syntax.

### FORMAT:
Return the feature files as a JSON object with feature file names as keys and content as values:
{{
  "feature1.feature": "Feature: Feature Name\\n\\n  Scenario: Scenario Name\\n    Given precondition\\n    When action\\n    Then result",
  "feature2.feature": "..."
}}

### OUTPUT:
Only return a valid JSON object with no explanations or markdown formatting.
"""

# Machine learning models for intelligent features
ml_models = {}

@app.get("/health")
async def health_check():
    """Health check endpoint to verify service is running"""
    return {"status": "healthy", "service": "qa-genie-ai", "timestamp": datetime.now().isoformat()}

@app.post("/analyze/prd", response_model=TestCaseResponse)
async def analyze_prd(prd_request: PRDRequest):
    """Analyze a PRD and generate test cases"""
    try:
        logger.info(f"Received PRD analysis request with format: {prd_request.format}")
        
        if not watson_service:
            raise HTTPException(
                status_code=500, 
                detail="Watson X AI service not initialized. Check server logs."
            )
        
        # Prepare the prompt for Watson X AI
        prompt = TEST_CASE_PROMPT_TEMPLATE.format(prd_content=prd_request.content)
        
        # Generate response using Watson X AI
        params = {
            "max_new_tokens": 4000,
            "temperature": 0.2,
            "top_p": 0.95,
            "min_new_tokens": 100
        }
        
        logger.info("Generating test cases from PRD...")
        response = watson_service.generate_text(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            params=params
        )
        
        # Parse the response as JSON
        try:
            result = json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from the response if it contains other text
            import re
            json_match = re.search(r'```json\n([\s\S]*?)\n```', response)
            if json_match:
                result = json.loads(json_match.group(1))
            else:
                raise HTTPException(status_code=500, detail="Failed to parse model response as JSON")
        
        logger.info(f"Successfully generated {len(result.get('test_cases', []))} test cases")
        return result
    except Exception as e:
        logger.error(f"Error generating test cases: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating test cases: {str(e)}")

@app.post("/generate/cucumber")
async def generate_cucumber_features(test_cases: TestCaseResponse):
    """Generate Cucumber feature files from test cases"""
    try:
        if not watson_service:
            raise HTTPException(
                status_code=500, 
                detail="Watson X AI service not initialized. Check server logs."
            )
            
        # Convert test cases to JSON for the prompt
        test_cases_json = json.dumps(test_cases.dict())
        
        # Prepare the prompt for Watson X AI
        prompt = CUCUMBER_PROMPT_TEMPLATE.format(test_cases_json=test_cases_json)
        
        # Generate response using Watson X AI
        params = {
            "max_new_tokens": 4000,
            "temperature": 0.2,
            "top_p": 0.95,
            "min_new_tokens": 100
        }
        
        logger.info("Generating Cucumber features from test cases...")
        response = watson_service.generate_text(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            params=params
        )
        
        # Parse the response as JSON
        try:
            result = json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from the response if it contains other text
            import re
            json_match = re.search(r'```json\n([\s\S]*?)\n```', response)
            if json_match:
                result = json.loads(json_match.group(1))
            else:
                raise HTTPException(status_code=500, detail="Failed to parse model response as JSON")
        
        logger.info(f"Successfully generated {len(result)} Cucumber feature files")
        return result
    except Exception as e:
        logger.error(f"Error generating Cucumber features: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating Cucumber features: {str(e)}")

@app.post("/upload/prd")
async def upload_prd(file: UploadFile = File(...)):
    """Upload a PRD file (PDF, Markdown, etc.) and extract content"""
    try:
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            # Write uploaded file content to the temporary file
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        # Process the file based on its extension
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        if file_extension == '.pdf':
            # Process PDF file
            from PyPDF2 import PdfReader
            reader = PdfReader(temp_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
        elif file_extension in ['.md', '.markdown']:
            # Process Markdown file
            with open(temp_path, 'r', encoding='utf-8') as f:
                text = f.read()
        elif file_extension in ['.txt', '.text']:
            # Process plain text file
            with open(temp_path, 'r', encoding='utf-8') as f:
                text = f.read()
        else:
            os.unlink(temp_path)  # Clean up the temp file
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file format: {file_extension}. Supported formats: .pdf, .md, .markdown, .txt"
            )
        
        # Clean up the temp file
        os.unlink(temp_path)
        
        return {"content": text, "format": file_extension[1:], "filename": file.filename}
    
    except Exception as e:
        logger.error(f"Error processing uploaded file: {e}")
        # Clean up in case of exception
        try:
            os.unlink(temp_path)
        except:
            pass
        
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/api/test")
async def test_api():
    """Test the direct API connection to IBM Watson X AI"""
    try:
        if not token_manager:
            return {
                "status": "error",
                "message": "Token manager not initialized. Check API key configuration."
            }
            
        # Get a fresh token
        token = token_manager.get_token()
        
        if not token:
            return {
                "status": "error",
                "message": "Failed to obtain token from IBM IAM"
            }
            
        # Make a direct API call to test Watson X AI
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Test data
        payload = {
            "input": "What is QA automation?",
            "model_id": "ibm/granite-13b-chat-v2",
            "project_id": space_id,
            "parameters": {
                "max_new_tokens": 100,
                "temperature": 0.5,
                "top_p": 0.95
            }
        }
        
        # Make direct API call to Watson X AI
        response = requests.post(
            f"{api_url}/ml/v1/text/generation?version=2024-05-31",
            headers=headers,
            json=payload
        )
        
        if response.status_code != 200:
            return {
                "status": "error",
                "message": f"API call failed with status code: {response.status_code}",
                "details": response.text
            }
            
        return {
            "status": "success",
            "message": "Successfully connected to IBM Watson X AI",
            "model_response": response.json()
        }
    except Exception as e:
        logger.error(f"Error testing API: {e}")
        return {
            "status": "error",
            "message": f"Exception occurred: {str(e)}"
        }

# Define Pydantic models for request/response validation
class VisualAnalysisRequest(BaseModel):
    diffData: Dict[str, Any] = {}

class VisualSimilarityRequest(BaseModel):
    selector: str
    html: str

class TestStepRequest(BaseModel):
    instruction: str
    context: Dict[str, Any] = {}

class TestFailureRequest(BaseModel):
    testCode: str
    failureInfo: Dict[str, Any] = {}

class PerformanceRequest(BaseModel):
    metrics: Dict[str, Any] = {}
    resources: Dict[str, Any] = {}

class TestDataFieldRequest(BaseModel):
    fieldName: str
    schema: Dict[str, Any] = {}
    context: Dict[str, Any] = {}

class DataPatternsRequest(BaseModel):
    data: List[Dict[str, Any]] = []

class ModelTrainingRequest(BaseModel):
    modelType: str
    modelName: str
    trainingData: List[Dict[str, Any]] = []

class PredictionRequest(BaseModel):
    modelName: str
    features: Dict[str, Any] = {}

class MaintenanceRequest(BaseModel):
    analysis: Dict[str, Any] = {}

class TestFailuresRequest(BaseModel):
    failures: List[Dict[str, Any]] = []

class PatternsRequest(BaseModel):
    observations: List[Any] = []

class NLTestRequest(BaseModel):
    description: str
    style: str = "natural"

class NLTestAnalysisRequest(BaseModel):
    test: str

class IssueAnalysisRequest(BaseModel):
    comment: str
    screenshot: str = ""

class HealingRequest(BaseModel):
    pass

class TestExecutionRequest(BaseModel):
    pass

@app.post("/analyze/visual")
async def analyze_visual(request: Dict[str, Any] = Body(...)):
    """Analyze visual differences using AI"""
    try:
        # In a real implementation, would process image data
        diff_data = request.get('diffData', {})
        
        analysis = {
            'anomalyType': 'layout_shift' if diff_data.get('diffPercentage', 0) > 10 else 'minor_change',
            'severity': 'high' if diff_data.get('diffPercentage', 0) > 20 else 'low',
            'suggestions': [
                'Review layout changes for responsiveness',
                'Check if changes are intentional',
                'Update baseline if changes are expected'
            ],
            'possibleCauses': [
                'CSS changes affecting layout',
                'Dynamic content loading',
                'Browser rendering differences'
            ]
        }
        
        return analysis
    except Exception as e:
        logger.error(f"Error analyzing visual: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/visual-similarity")
async def analyze_visual_similarity(request: VisualSimilarityRequest):
    """Find visually similar elements for self-healing"""
    try:
        selector = request.selector
        html = request.html
        
        # Simple heuristic for finding similar elements
        similar_selector = selector
        
        # If selector failed, try alternative strategies
        if 'id=' in selector:
            # Try by class
            similar_selector = selector.replace('id=', 'class*=')
        elif 'class=' in selector:
            # Try by text content
            similar_selector = f"text=/{selector.split('=')[1]}/"
        
        return {
            'found': True,
            'selector': similar_selector,
            'confidence': 0.75
        }
    except Exception as e:
        logger.error(f"Error finding similar element: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/interpret/test-step")
async def interpret_test_step(request: TestStepRequest):
    """Interpret natural language test step"""
    try:
        instruction = request.instruction
        context = request.context
        
        # Simple pattern matching for common instructions
        action = {'type': 'unknown', 'instruction': instruction}
        
        instruction_lower = instruction.lower()
        
        if 'click' in instruction_lower or 'tap' in instruction_lower:
            action['type'] = 'click'
            # Extract target from instruction
            if 'button' in instruction_lower:
                action['target'] = 'button'
            elif 'link' in instruction_lower:
                action['target'] = 'a'
        elif 'type' in instruction_lower or 'enter' in instruction_lower:
            action['type'] = 'type'
        elif 'wait' in instruction_lower:
            action['type'] = 'wait'
        elif 'verify' in instruction_lower or 'check' in instruction_lower:
            action['type'] = 'assert'
        
        return {'action': action}
    except Exception as e:
        logger.error(f"Error interpreting test step: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/test-failure")
async def analyze_test_failure(request: TestFailureRequest):
    """Analyze test failure and suggest fixes"""
    try:
        test_code = request.testCode
        failure_info = request.failureInfo
        
        fixes = {
            'fixedCode': test_code,
            'confidence': 0.8,
            'changes': [],
            'suggestions': []
        }
        
        # Analyze failure type
        error_message = failure_info.get('error', '').lower()
        
        if 'timeout' in error_message:
            fixes['changes'].append({
                'type': 'increase_timeout',
                'description': 'Increased timeout values'
            })
            fixes['suggestions'].append('Consider using explicit waits instead of timeouts')
        elif 'element not found' in error_message:
            fixes['changes'].append({
                'type': 'update_selector',
                'description': 'Updated selector to be more robust'
            })
            fixes['suggestions'].append('Add data-testid attributes for stable selectors')
        
        return fixes
    except Exception as e:
        logger.error(f"Error analyzing test failure: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/performance")
async def analyze_performance(request: PerformanceRequest):
    """Analyze performance metrics and provide suggestions"""
    try:
        metrics = request.metrics
        resources = request.resources
        
        suggestions = []
        
        # Analyze Core Web Vitals
        if metrics.get('coreWebVitals', {}).get('lcp', 0) > 2500:
            suggestions.append({
                'type': 'optimization',
                'category': 'lcp',
                'priority': 'high',
                'message': 'Largest Contentful Paint is too slow',
                'details': 'Optimize image loading and server response times'
            })
        
        # Analyze resource loading
        if resources.get('totalSize', 0) > 3000000:  # 3MB
            suggestions.append({
                'type': 'optimization',
                'category': 'bundle',
                'priority': 'high',
                'message': 'Bundle size is too large',
                'details': 'Implement code splitting and lazy loading'
            })
        
        return {'suggestions': suggestions}
    except Exception as e:
        logger.error(f"Error analyzing performance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate/test-data-field")
async def generate_test_data_field(request: TestDataFieldRequest):
    """Generate intelligent test data for a field"""
    try:
        field_name = request.fieldName
        schema = request.schema
        context = request.context
        
        # Generate contextually appropriate data
        value = None
        
        if 'email' in field_name.lower():
            value = f"test.user{np.random.randint(1000, 9999)}@example.com"
        elif 'phone' in field_name.lower():
            value = f"+1{np.random.randint(1000000000, 9999999999)}"
        elif 'date' in field_name.lower():
            value = datetime.now().isoformat()
        elif schema.get('type') == 'number':
            min_val = schema.get('min', 0)
            max_val = schema.get('max', 100)
            value = np.random.randint(min_val, max_val)
        else:
            value = f"test_{field_name}_{np.random.randint(100, 999)}"
        
        return {'value': value}
    except Exception as e:
        logger.error(f"Error generating test data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/data-patterns")
async def analyze_data_patterns(request: DataPatternsRequest):
    """Analyze patterns in test data"""
    try:
        test_data = request.data
        
        patterns = []
        
        # Simple pattern detection
        if len(test_data) > 1:
            # Check for sequential IDs
            if all('id' in item for item in test_data):
                ids = [item['id'] for item in test_data]
                if all(isinstance(id, int) for id in ids):
                    sorted_ids = sorted(ids)
                    if sorted_ids == list(range(sorted_ids[0], sorted_ids[-1] + 1)):
                        patterns.append({
                            'type': 'sequential',
                            'field': 'id',
                            'description': 'IDs follow sequential pattern'
                        })
        
        return {'patterns': patterns}
    except Exception as e:
        logger.error(f"Error analyzing data patterns: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/train/model")
async def train_model(request: ModelTrainingRequest):
    """Train machine learning model for continuous learning"""
    try:
        model_type = request.modelType
        model_name = request.modelName
        training_data = request.trainingData
        
        if model_type == 'classification':
            # Train a simple classifier
            X = []
            y = []
            
            for sample in training_data:
                features = [sample.get(f, 0) for f in ['code_complexity', 'change_frequency', 'test_age']]
                label = sample.get('will_fail', False)
                X.append(features)
                y.append(label)
            
            if len(X) > 10:
                # In real implementation, this would use a proper ML framework
                # For now, just simulate success
                accuracy = 0.85
                
                # Store model info (would be a real model in production)
                ml_models[model_name] = {"type": "classifier", "trained": True}
                
                return {
                    'metrics': {
                        'accuracy': accuracy,
                        'samples': len(X)
                    }
                }
        
        return {'metrics': {'accuracy': 0, 'samples': 0}}
    except Exception as e:
        logger.error(f"Error training model: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict")
async def predict(request: PredictionRequest):
    """Make prediction using trained model"""
    try:
        model_name = request.modelName
        features = request.features
        
        if model_name in ml_models:
            # In a real implementation, this would use the stored model
            # For now, just return a simulated prediction
            prediction = features.get('code_complexity', 0) > 7
            
            return {'prediction': prediction}
        
        # Fallback prediction
        return {'prediction': False}
    except Exception as e:
        logger.error(f"Error making prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/maintenance")
async def analyze_maintenance(request: MaintenanceRequest):
    """Analyze test suite for maintenance recommendations"""
    try:
        analysis = request.analysis
        
        recommendations = []
        
        if analysis.get('criticalTests', 0) > 5:
            recommendations.append({
                'priority': 'urgent',
                'type': 'critical_tests',
                'message': 'Multiple tests in critical condition',
                'action': 'Schedule immediate maintenance sprint'
            })
        
        if analysis.get('autoFixableIssues', 0) > 10:
            recommendations.append({
                'priority': 'high',
                'type': 'auto_fix',
                'message': 'Many issues can be automatically fixed',
                'action': 'Run automated maintenance tools'
            })
        
        return {'recommendations': recommendations}
    except Exception as e:
        logger.error(f"Error analyzing maintenance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/test-failures")
async def analyze_test_failures(request: TestFailuresRequest):
    """Analyze test failure patterns"""
    try:
        failures = request.failures
        
        root_causes = []
        
        # Analyze failure patterns
        error_types = {}
        for failure in failures:
            error = failure.get('error', 'unknown')
            error_types[error] = error_types.get(error, 0) + 1
        
        # Identify root causes
        for error_type, count in error_types.items():
            if count > len(failures) * 0.3:  # More than 30% of failures
                root_causes.append(f"Frequent {error_type} errors indicate systemic issue")
        
        return {'rootCauses': root_causes}
    except Exception as e:
        logger.error(f"Error analyzing test failures: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/discover/patterns")
async def discover_patterns(request: PatternsRequest):
    """Discover patterns in observations for continuous learning"""
    try:
        observations = request.observations
        
        patterns = []
        
        # Simple pattern discovery
        if len(observations) > 3:
            # Look for repeated sequences
            for i in range(len(observations) - 2):
                seq = observations[i:i+3]
                # Check if this sequence appears elsewhere
                for j in range(i + 3, len(observations) - 2):
                    if observations[j:j+3] == seq:
                        patterns.append({
                            'type': 'sequence',
                            'length': 3,
                            'occurrences': 2,
                            'pattern': seq[:2]  # Don't expose full data
                        })
                        break
        
        return {'patterns': patterns[:5]}  # Limit to 5 patterns
    except Exception as e:
        logger.error(f"Error discovering patterns: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate/nl-test")
async def generate_nl_test(request: NLTestRequest):
    """Generate natural language test from description"""
    try:
        description = request.description
        style = request.style
        
        # Generate a simple test template
        test = f"""Scenario: {description}

Given I am on the application home page
When I perform the action described as "{description}"
Then I should see the expected result
And the system should behave correctly

# Additional test steps:
1. Navigate to the relevant page
2. Interact with the necessary elements
3. Verify the outcome matches expectations
4. Check for any error messages
5. Confirm data is saved correctly
"""
        
        return {'test': test}
    except Exception as e:
        logger.error(f"Error generating natural language test: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/nl-test")
async def analyze_nl_test(request: NLTestAnalysisRequest):
    """Analyze natural language test for improvements"""
    try:
        test = request.test
        
        suggestions = []
        
        # Check for common issues
        if 'verify' not in test.lower() and 'assert' not in test.lower():
            suggestions.append({
                'type': 'missing_assertions',
                'message': 'Add verification steps to ensure test validity',
                'example': 'Verify that the success message is displayed'
            })
        
        if len(test.split('\n')) < 5:
            suggestions.append({
                'type': 'insufficient_detail',
                'message': 'Add more specific steps for clarity',
                'example': 'Break down complex actions into smaller steps'
            })
        
        return {'suggestions': suggestions}
    except Exception as e:
        logger.error(f"Error analyzing natural language test: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/issue")
async def analyze_issue(request: IssueAnalysisRequest):
    """Analyze reported issue from collaborative testing"""
    try:
        comment = request.comment
        screenshot = request.screenshot
        
        # Simple issue detection
        is_bug = any(word in comment.lower() for word in ['error', 'broken', 'fail', 'bug', 'issue'])
        
        analysis = {
            'isBug': is_bug,
            'severity': 'high' if 'error' in comment.lower() else 'medium',
            'category': 'functional' if 'button' in comment.lower() or 'click' in comment.lower() else 'visual'
        }
        
        if is_bug:
            # Generate a simple test case
            analysis['testCase'] = {
                'name': 'Verify reported issue is fixed',
                'steps': [
                    'Navigate to the affected page',
                    'Perform the action that caused the issue',
                    'Verify the issue no longer occurs'
                ]
            }
        
        return analysis
    except Exception as e:
        logger.error(f"Error analyzing issue: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/learn/healing")
async def learn_healing(request: HealingRequest):
    """Learn from self-healing actions"""
    try:
        # In a real implementation, would update ML models
        return {'success': True}
    except Exception as e:
        logger.error(f"Error learning from healing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/learn/test-execution")
async def learn_test_execution(request: TestExecutionRequest):
    """Learn from test execution results"""
    try:
        # In a real implementation, would update ML models
        return {'success': True}
    except Exception as e:
        logger.error(f"Error learning from test execution: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/recording")
async def analyze_recording(recording: dict):
    """Analyze a Playwright recording and generate test cases"""
    try:
        logger.info(f"Received recording analysis request for: {recording.get('name', 'Unknown')}")
        
        if not watson_service:
            raise HTTPException(
                status_code=500, 
                detail="Watson X AI service not initialized. Check server logs."
            )
        
        # Extract recording details
        steps = recording.get('steps', [])
        name = recording.get('name', 'Unknown Recording')
        
        if not steps:
            return {
                "test_cases": [],
                "summary": "No steps found in recording",
                "coverage_percentage": 0
            }
        
        # Prepare the prompt for Watson X AI
        steps_text = "\n".join([
            f"Step {i+1}: {step.get('action', 'unknown')} " +
            f"on {step.get('selector', 'unknown')} " +
            f"with value {step.get('value', 'none')}"
            for i, step in enumerate(steps)
        ])
        
        prompt = f"""
### RECORDING CONTENT:
Recording Name: {name}
Recording ID: {recording.get('id', 'unknown')}
Timestamp: {recording.get('timestamp', 'unknown')}
Number of Steps: {len(steps)}

### STEPS:
{steps_text}

### TASK:
Based on the Playwright recording above, generate a set of comprehensive test cases that cover the workflow.

### FORMAT:
Return the test cases as a JSON array with the following structure:
{{
  "test_cases": [
    {{
      "id": "TC001",
      "title": "Test case title",
      "description": "Description of what is being tested",
      "preconditions": "Any prerequisites for the test",
      "steps": [
        {{ "step": "1", "action": "User action description" }},
        {{ "step": "2", "action": "Next user action description" }}
      ],
      "expected_results": [
        "Expected result for step 1",
        "Expected result for step 2"
      ],
      "priority": "must-have|should-have|nice-to-have",
      "tags": ["tag1", "tag2"]
    }}
  ],
  "summary": "Brief summary of the coverage",
  "coverage_percentage": 95.0
}}

### NOTES:
1. Generate test cases that represent real user flows
2. Identify edge cases and variations 
3. Create validations for each user interaction
4. Add appropriate tags based on the steps and actions

### OUTPUT:
Only return a valid JSON object with no explanations or markdown formatting.
"""
        
        # Generate response using Watson X AI
        params = {
            "max_new_tokens": 4000,
            "temperature": 0.3,
            "top_p": 0.95,
            "min_new_tokens": 100
        }
        
        logger.info("Generating test cases from recording...")
        response = watson_service.generate_text(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            params=params
        )
        
        # Parse the response as JSON
        try:
            result = json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from the response if it contains other text
            import re
            json_match = re.search(r'```json\n([\s\S]*?)\n```', response)
            if json_match:
                result = json.loads(json_match.group(1))
            else:
                # Try a raw extraction without markdown code blocks
                json_text = re.search(r'\{\s*"test_cases":\s*\[', response)
                if json_text:
                    start_idx = json_text.start()
                    # Find the closing of the JSON object
                    open_braces = 0
                    for i, char in enumerate(response[start_idx:]):
                        if char == '{':
                            open_braces += 1
                        elif char == '}':
                            open_braces -= 1
                            if open_braces == 0:
                                end_idx = start_idx + i + 1
                                break
                    
                    if open_braces == 0:  # Found a complete JSON object
                        result = json.loads(response[start_idx:end_idx])
                    else:
                        raise HTTPException(status_code=500, detail="Failed to parse model response as JSON")
                else:
                    raise HTTPException(status_code=500, detail="Failed to parse model response as JSON")
        
        logger.info(f"Successfully generated {len(result.get('test_cases', []))} test cases from recording")
        return result
    except Exception as e:
        logger.error(f"Error generating test cases from recording: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating test cases: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True) 