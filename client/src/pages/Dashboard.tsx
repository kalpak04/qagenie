import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  DocumentTextIcon, 
  ClipboardDocumentCheckIcon, 
  CodeBracketIcon, 
  ServerIcon, 
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import { prdAPI, testCaseAPI, ciAPI } from '../services/api';

interface StatsData {
  prds: number;
  testCases: number;
  automatedTests: number;
  passRate: number;
  recentBuilds: {
    id: string;
    repository: string;
    status: 'success' | 'failed' | 'running';
    timestamp: string;
  }[];
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<StatsData>({
    prds: 0,
    testCases: 0,
    automatedTests: 0,
    passRate: 0,
    recentBuilds: [],
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // In a real implementation, you'd make API calls to get this data
        // For now, we'll use mock data
        
        // Simulate API calls with a timeout
        setTimeout(() => {
          setStats({
            prds: 8,
            testCases: 156,
            automatedTests: 127,
            passRate: 92,
            recentBuilds: [
              {
                id: 'build-123',
                repository: 'main-app',
                status: 'success',
                timestamp: '2025-06-20T10:30:00Z',
              },
              {
                id: 'build-122',
                repository: 'api-service',
                status: 'failed',
                timestamp: '2025-06-20T09:15:00Z',
              },
              {
                id: 'build-121',
                repository: 'main-app',
                status: 'success',
                timestamp: '2025-06-19T15:45:00Z',
              },
            ],
          });
          setLoading(false);
        }, 1000);
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  const quickLinks = [
    {
      name: 'Upload PRD',
      description: 'Add a new Product Requirements Document',
      href: '/prds/upload',
      icon: DocumentTextIcon,
      color: 'bg-purple-500',
    },
    {
      name: 'Generate Test Cases',
      description: 'Create test cases from a PRD',
      href: '/test-cases/generate',
      icon: ClipboardDocumentCheckIcon,
      color: 'bg-blue-500',
    },
    {
      name: 'Generate Feature Files',
      description: 'Convert test cases to Cucumber features',
      href: '/features/generate',
      icon: CodeBracketIcon,
      color: 'bg-green-500',
    },
    {
      name: 'CI Dashboard',
      description: 'View CI build status and history',
      href: '/ci',
      icon: ServerIcon,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="py-6">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      
      {loading ? (
        <div className="mt-6 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* PRDs card */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                      <DocumentTextIcon className="h-6 w-6 text-purple-600" aria-hidden="true" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total PRDs</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">{stats.prds}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="text-sm">
                    <Link to="/prds" className="font-medium text-primary-600 hover:text-primary-500">
                      View all PRDs
                    </Link>
                  </div>
                </div>
              </div>
              
              {/* Test Cases card */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                      <ClipboardDocumentCheckIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Test Cases</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">{stats.testCases}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="text-sm">
                    <Link to="/test-cases" className="font-medium text-primary-600 hover:text-primary-500">
                      View all test cases
                    </Link>
                  </div>
                </div>
              </div>
              
              {/* Automated Tests card */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                      <CodeBracketIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Automated Tests</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">{stats.automatedTests}</div>
                          <p className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                            <span className="sr-only">Automated</span>
                            {Math.round((stats.automatedTests / stats.testCases) * 100)}%
                          </p>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="text-sm">
                    <Link to="/features" className="font-medium text-primary-600 hover:text-primary-500">
                      View feature files
                    </Link>
                  </div>
                </div>
              </div>
              
              {/* Pass Rate card */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-orange-100 rounded-md p-3">
                      <ServerIcon className="h-6 w-6 text-orange-600" aria-hidden="true" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Test Pass Rate</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">{stats.passRate}%</div>
                          <p className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                            <ArrowUpIcon className="self-center flex-shrink-0 h-4 w-4 text-green-500" aria-hidden="true" />
                            <span className="sr-only">Increased by </span>
                            2.3%
                          </p>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="text-sm">
                    <Link to="/ci" className="font-medium text-primary-600 hover:text-primary-500">
                      View CI results
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8">
            <h2 className="text-lg font-medium text-gray-900">Quick Actions</h2>
            <div className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {quickLinks.map((link) => (
                <div key={link.name} className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className={`flex-shrink-0 rounded-md p-3 ${link.color}`}>
                        <link.icon className="h-6 w-6 text-white" aria-hidden="true" />
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">{link.name}</h3>
                        <p className="text-sm text-gray-500">{link.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-4 sm:px-6">
                    <div className="text-sm">
                      <Link to={link.href} className="font-medium text-primary-600 hover:text-primary-500">
                        Go <span aria-hidden="true">&rarr;</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-8">
            <h2 className="text-lg font-medium text-gray-900">Recent CI Builds</h2>
            <div className="mt-2 flex flex-col">
              <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                  <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Build ID
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Repository
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Timestamp
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {stats.recentBuilds.map((build) => (
                          <tr key={build.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              <Link to={`/ci/builds/${build.id}`} className="text-primary-600 hover:text-primary-900">
                                {build.id}
                              </Link>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {build.repository}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${build.status === 'success' ? 'bg-green-100 text-green-800' : 
                                  build.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                {build.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(build.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm">
              <Link to="/ci" className="font-medium text-primary-600 hover:text-primary-500">
                View all builds <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard; 