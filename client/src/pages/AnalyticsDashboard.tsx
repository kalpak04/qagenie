import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut, Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import api from '../services/api';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TestMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageDuration: number;
  executionTrend: Array<{ date: string; count: number }>;
  failuresByComponent: Array<{ component: string; failures: number }>;
  performanceData: Array<{ testName: string; duration: number }>;
  coverageData: {
    line: number;
    branch: number;
    function: number;
    statement: number;
  };
}

interface RealTimeMetric {
  id: string;
  type: string;
  value: number;
  timestamp: string;
}

const AnalyticsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<TestMetrics | null>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetric[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [activeTests, setActiveTests] = useState(0);
  const [testHealth, setTestHealth] = useState(0);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchRealTimeMetrics, 5000);
    
    // WebSocket connection for real-time updates
    const ws = new WebSocket('ws://localhost:7001/metrics');
    
    ws.onmessage = (event) => {
      const metric = JSON.parse(event.data);
      setRealTimeMetrics(prev => [...prev.slice(-50), metric]);
      
      if (metric.type === 'test_started') {
        setActiveTests(prev => prev + 1);
      } else if (metric.type === 'test_completed') {
        setActiveTests(prev => Math.max(0, prev - 1));
      }
    };

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, [selectedTimeRange]);

  const fetchMetrics = async () => {
    try {
      const response = await api.get(`/analytics/metrics?range=${selectedTimeRange}`);
      setMetrics(response.data);
      calculateTestHealth(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      setLoading(false);
    }
  };

  const fetchRealTimeMetrics = async () => {
    try {
      const response = await api.get('/analytics/realtime');
      if (response.data.activeTests !== undefined) {
        setActiveTests(response.data.activeTests);
      }
    } catch (error) {
      console.error('Failed to fetch real-time metrics:', error);
    }
  };

  const calculateTestHealth = (data: TestMetrics) => {
    const passRate = (data.passedTests / data.totalTests) * 100;
    const performanceScore = data.averageDuration < 5000 ? 100 : 
                           data.averageDuration < 10000 ? 70 : 40;
    const coverageScore = (data.coverageData.line + data.coverageData.branch) / 2;
    
    setTestHealth(Math.round((passRate + performanceScore + coverageScore) / 3));
  };

  const getTestHealthColor = () => {
    if (testHealth >= 80) return 'text-green-600';
    if (testHealth >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const executionTrendData = {
    labels: metrics?.executionTrend.map(item => item.date) || [],
    datasets: [
      {
        label: 'Test Executions',
        data: metrics?.executionTrend.map(item => item.count) || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const passFailData = {
    labels: ['Passed', 'Failed'],
    datasets: [
      {
        data: [metrics?.passedTests || 0, metrics?.failedTests || 0],
        backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(239, 68, 68, 0.8)'],
        borderColor: ['rgb(34, 197, 94)', 'rgb(239, 68, 68)'],
        borderWidth: 1
      }
    ]
  };

  const failuresByComponentData = {
    labels: metrics?.failuresByComponent.map(item => item.component) || [],
    datasets: [
      {
        label: 'Failures',
        data: metrics?.failuresByComponent.map(item => item.failures) || [],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 1
      }
    ]
  };

  const performanceScatterData = {
    datasets: [
      {
        label: 'Test Performance',
        data: metrics?.performanceData.map((item, index) => ({
          x: index,
          y: item.duration,
          testName: item.testName
        })) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        pointRadius: 6,
        pointHoverRadius: 8
      }
    ]
  };

  const coverageData = {
    labels: ['Line', 'Branch', 'Function', 'Statement'],
    datasets: [
      {
        label: 'Coverage %',
        data: [
          metrics?.coverageData.line || 0,
          metrics?.coverageData.branch || 0,
          metrics?.coverageData.function || 0,
          metrics?.coverageData.statement || 0
        ],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 1
      }
    ]
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">Real-time test execution insights and metrics</p>
        </div>

        {/* Time Range Selector */}
        <div className="mb-6 flex gap-2">
          {['24h', '7d', '30d', '90d'].map(range => (
            <button
              key={range}
              onClick={() => setSelectedTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedTimeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {range === '24h' ? 'Last 24 Hours' :
               range === '7d' ? 'Last 7 Days' :
               range === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
            </button>
          ))}
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tests</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {metrics?.totalTests || 0}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pass Rate</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {metrics ? Math.round((metrics.passedTests / metrics.totalTests) * 100) : 0}%
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Tests</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {activeTests}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <div className="animate-pulse">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Test Health</p>
                <p className={`text-2xl font-bold mt-1 ${getTestHealthColor()}`}>
                  {testHealth}%
                </p>
              </div>
              <div className={`p-3 rounded-lg ${
                testHealth >= 80 ? 'bg-green-100' :
                testHealth >= 60 ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
                <svg className={`w-6 h-6 ${
                  testHealth >= 80 ? 'text-green-600' :
                  testHealth >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Execution Trend */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution Trend</h3>
            <Line 
              data={executionTrendData} 
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }}
            />
          </div>

          {/* Pass/Fail Distribution */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pass/Fail Distribution</h3>
            <div className="flex items-center justify-center h-64">
              <Doughnut 
                data={passFailData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom'
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Failures by Component */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Failures by Component</h3>
            <Bar 
              data={failuresByComponentData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }}
            />
          </div>

          {/* Coverage Metrics */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Code Coverage</h3>
            <Bar 
              data={coverageData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Performance Analysis */}
        <div className="mt-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Performance Distribution</h3>
          <Scatter 
            data={performanceScatterData}
            options={{
              responsive: true,
              plugins: {
                tooltip: {
                  callbacks: {
                    label: (context: any) => {
                      return `${context.raw.testName}: ${context.parsed.y}ms`;
                    }
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Duration (ms)'
                  }
                },
                x: {
                  title: {
                    display: true,
                    text: 'Test Index'
                  }
                }
              }
            }}
          />
        </div>

        {/* Real-time Activity Feed */}
        <div className="mt-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Real-time Activity</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {realTimeMetrics.slice(-10).reverse().map((metric, index) => (
              <div key={metric.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    metric.type === 'test_passed' ? 'bg-green-500' :
                    metric.type === 'test_failed' ? 'bg-red-500' :
                    'bg-blue-500'
                  }`}></div>
                  <span className="text-sm text-gray-700">{metric.type.replace('_', ' ')}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(metric.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard; 