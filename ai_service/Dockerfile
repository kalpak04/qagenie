FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

# Set environment variables
ENV PORT=8000
ENV HOST=0.0.0.0

# Expose the port
EXPOSE 8000

# Run the application with uvicorn worker
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "1", "--worker-class", "uvicorn.workers.UvicornWorker", "app:app"] 