'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ValidationSummary {
    total_records: number;
    matched_records: number;
    unmatched_records: number;
    suspicious_ranks: number;
    match_rate: number;
    by_state: any[];
    by_round: any[];
    by_college: any[];
}

interface TreeNode {
    id: string;
    label: string;
    type: 'year' | 'round' | 'state' | 'college' | 'course' | 'category' | 'quota' | 'data';
    children?: TreeNode[];
    data?: any;
    expanded?: boolean;
}

export default function StagingEditor() {
    const [summary, setSummary] = useState<ValidationSummary | null>(null);
    const [treeData, setTreeData] = useState<TreeNode[]>([]);
    const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({
        state: '',
        round: '',
        matchStatus: 'all'
    });

    useEffect(() => {
        loadStagingData();
    }, []);

    const loadStagingData = async () => {
        try {
            setLoading(true);
            
            // Load validation summary
            const summaryResponse = await fetch('/api/staging/summary');
            const summaryData = await summaryResponse.json();
            setSummary(summaryData);

            // Load treeview data
            const treeResponse = await fetch('/api/staging/treeview');
            const treeRawData = await treeResponse.json();
            
            // Transform to tree structure
            const transformedTree = transformToTreeNodes(treeRawData);
            setTreeData(transformedTree);

        } catch (error) {
            console.error('Failed to load staging data:', error);
        } finally {
            setLoading(false);
        }
    };

    const transformToTreeNodes = (data: any): TreeNode[] => {
        const nodes: TreeNode[] = [];

        Object.entries(data).forEach(([year, rounds]: [string, any]) => {
            const yearNode: TreeNode = {
                id: `year-${year}`,
                label: `📅 ${year}`,
                type: 'year',
                children: [],
                expanded: false
            };

            Object.entries(rounds).forEach(([round, states]: [string, any]) => {
                const roundNode: TreeNode = {
                    id: `${year}-${round}`,
                    label: `🔄 ${round}`,
                    type: 'round',
                    children: [],
                    expanded: false
                };

                Object.entries(states).forEach(([state, colleges]: [string, any]) => {
                    const stateNode: TreeNode = {
                        id: `${year}-${round}-${state}`,
                        label: `🏛️ ${state}`,
                        type: 'state',
                        children: [],
                        expanded: false
                    };

                    Object.entries(colleges).forEach(([college, courses]: [string, any]) => {
                        const collegeNode: TreeNode = {
                            id: `${year}-${round}-${state}-${college}`,
                            label: `🏥 ${college}`,
                            type: 'college',
                            children: [],
                            expanded: false
                        };

                        Object.entries(courses).forEach(([course, categories]: [string, any]) => {
                            const courseNode: TreeNode = {
                                id: `${year}-${round}-${state}-${college}-${course}`,
                                label: `📚 ${course}`,
                                type: 'course',
                                children: [],
                                expanded: false
                            };

                            Object.entries(categories).forEach(([category, quotas]: [string, any]) => {
                                const categoryNode: TreeNode = {
                                    id: `${year}-${round}-${state}-${college}-${course}-${category}`,
                                    label: `👥 ${category}`,
                                    type: 'category',
                                    children: [],
                                    expanded: false
                                };

                                Object.entries(quotas).forEach(([quota, data]: [string, any]) => {
                                    const quotaNode: TreeNode = {
                                        id: `${year}-${round}-${state}-${college}-${course}-${category}-${quota}`,
                                        label: `🎯 ${quota}`,
                                        type: 'quota',
                                        data,
                                        expanded: false
                                    };

                                    categoryNode.children!.push(quotaNode);
                                });

                                courseNode.children!.push(categoryNode);
                            });

                            collegeNode.children!.push(courseNode);
                        });

                        stateNode.children!.push(collegeNode);
                    });

                    roundNode.children!.push(stateNode);
                });

                yearNode.children!.push(roundNode);
            });

            nodes.push(yearNode);
        });

        return nodes;
    };

    const toggleNode = (nodeId: string) => {
        const updateNode = (nodes: TreeNode[]): TreeNode[] => {
            return nodes.map(node => {
                if (node.id === nodeId) {
                    return { ...node, expanded: !node.expanded };
                }
                if (node.children) {
                    return { ...node, children: updateNode(node.children) };
                }
                return node;
            });
        };

        setTreeData(updateNode(treeData));
    };

    const renderTreeNode = (node: TreeNode, level: number = 0): JSX.Element => {
        const indent = level * 20;
        const hasChildren = node.children && node.children.length > 0;
        
        return (
            <div key={node.id} className="select-none">
                <div 
                    className={`flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer ${
                        selectedNode?.id === node.id ? 'bg-blue-100' : ''
                    }`}
                    style={{ paddingLeft: `${indent + 8}px` }}
                    onClick={() => {
                        if (hasChildren) {
                            toggleNode(node.id);
                        } else {
                            setSelectedNode(node);
                        }
                    }}
                >
                    {hasChildren && (
                        <span className="mr-1 text-gray-500">
                            {node.expanded ? '▼' : '▶'}
                        </span>
                    )}
                    <span className="text-sm">{node.label}</span>
                    
                    {/* Show data indicators */}
                    {node.data && (
                        <div className="ml-auto flex gap-1">
                            <Badge variant={node.data.match_rate === 100 ? 'default' : 'destructive'}>
                                {node.data.match_rate.toFixed(0)}%
                            </Badge>
                            {node.data.suspicious_count > 0 && (
                                <Badge variant="destructive">⚠️ {node.data.suspicious_count}</Badge>
                            )}
                            <Badge variant="outline">
                                {node.data.opening_rank}-{node.data.closing_rank}
                            </Badge>
                        </div>
                    )}
                </div>
                
                {/* Render children if expanded */}
                {hasChildren && node.expanded && (
                    <div>
                        {node.children!.map(child => renderTreeNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    const runMatching = async () => {
        try {
            setLoading(true);
            await fetch('/api/staging/match', { method: 'POST' });
            await loadStagingData();
        } catch (error) {
            console.error('Matching failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateRanks = async () => {
        try {
            setLoading(true);
            await fetch('/api/staging/calculate-ranks', { method: 'POST' });
            await loadStagingData();
        } catch (error) {
            console.error('Rank calculation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportToMain = async () => {
        try {
            setLoading(true);
            await fetch('/api/staging/export', { method: 'POST' });
            alert('Export completed successfully!');
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading staging database...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">📊 Staging Database Editor</h1>
                    <p className="text-gray-600 mt-2">
                        Import → Edit → Calculate → Match → Validate → Export
                    </p>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">Total Records</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{summary.total_records.toLocaleString()}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">Match Rate</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {summary.match_rate.toFixed(1)}%
                                </div>
                                <div className="text-sm text-gray-500">
                                    {summary.matched_records.toLocaleString()} matched
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">Unmatched</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">
                                    {summary.unmatched_records.toLocaleString()}
                                </div>
                                <div className="text-sm text-gray-500">
                                    Need review
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-600">Suspicious Ranks</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-yellow-600">
                                    {summary.suspicious_ranks.toLocaleString()}
                                </div>
                                <div className="text-sm text-gray-500">
                                    ⚠️ Need validation
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4 mb-6">
                    <Button onClick={runMatching} disabled={loading}>
                        🔍 Run College Matching
                    </Button>
                    <Button onClick={calculateRanks} disabled={loading}>
                        📊 Calculate Ranks
                    </Button>
                    <Button onClick={exportToMain} disabled={loading} variant="outline">
                        📤 Export to Main DB
                    </Button>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Treeview Panel */}
                    <Card className="h-[600px]">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                🌳 Hierarchical Data View
                                <Badge variant="outline">Year → Round → State → College → Course → Category → Quota</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-auto h-[500px]">
                            <div className="space-y-1">
                                {treeData.map(node => renderTreeNode(node))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Details Panel */}
                    <Card className="h-[600px]">
                        <CardHeader>
                            <CardTitle>📋 Record Details</CardTitle>
                        </CardHeader>
                        <CardContent className="overflow-auto h-[500px]">
                            {selectedNode ? (
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-semibold text-lg">{selectedNode.label}</h3>
                                        <p className="text-gray-600">Type: {selectedNode.type}</p>
                                    </div>

                                    {selectedNode.data && (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-sm font-medium text-gray-600">Records</label>
                                                    <div className="text-lg font-semibold">{selectedNode.data.record_count}</div>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-gray-600">Match Rate</label>
                                                    <div className="text-lg font-semibold">
                                                        <Badge variant={selectedNode.data.match_rate === 100 ? 'default' : 'destructive'}>
                                                            {selectedNode.data.match_rate.toFixed(1)}%
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-sm font-medium text-gray-600">Opening Rank</label>
                                                    <div className="text-lg font-semibold text-green-600">
                                                        {selectedNode.data.opening_rank}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-gray-600">Closing Rank</label>
                                                    <div className="text-lg font-semibold text-red-600">
                                                        {selectedNode.data.closing_rank}
                                                    </div>
                                                </div>
                                            </div>

                                            {selectedNode.data.matched_college && (
                                                <div>
                                                    <label className="text-sm font-medium text-gray-600">Matched College</label>
                                                    <div className="text-lg font-semibold text-blue-600">
                                                        {selectedNode.data.matched_college}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        Confidence: {(selectedNode.data.avg_confidence * 100).toFixed(1)}%
                                                    </div>
                                                </div>
                                            )}

                                            {selectedNode.data.suspicious_count > 0 && (
                                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-yellow-600">⚠️</span>
                                                        <span className="font-medium text-yellow-800">
                                                            {selectedNode.data.suspicious_count} Suspicious Ranks
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-yellow-700 mt-1">
                                                        Opening rank &gt; Closing rank detected
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 mt-20">
                                    <div className="text-4xl mb-4">🌳</div>
                                    <p>Select a node from the tree to view details</p>
                                    <p className="text-sm mt-2">
                                        Click on any college, course, or quota level to see detailed information
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Stats */}
                {summary && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>📊 Top States by Records</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {summary.by_state.slice(0, 10).map((state: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center">
                                            <span className="text-sm">{state.state}</span>
                                            <div className="flex gap-2">
                                                <Badge variant="outline">{state.total}</Badge>
                                                <Badge variant={state.match_rate === 100 ? 'default' : 'destructive'}>
                                                    {state.match_rate}%
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>🔄 Rounds Progress</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {summary.by_round.map((round: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center">
                                            <span className="text-sm">{round.year} {round.round}</span>
                                            <div className="flex gap-2">
                                                <Badge variant="outline">{round.total}</Badge>
                                                <Badge variant={round.match_rate === 100 ? 'default' : 'destructive'}>
                                                    {round.match_rate}%
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Instructions */}
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>📝 How to Use Staging Database</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-semibold mb-2">🔧 In DB Browser for SQLite:</h4>
                                <ul className="text-sm space-y-1 text-gray-600">
                                    <li>• Open: <code>data/staging-counselling.db</code></li>
                                    <li>• Edit college mappings directly</li>
                                    <li>• Fix suspicious rank calculations</li>
                                    <li>• Add manual college mappings</li>
                                    <li>• Validate data quality</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">🌐 In Web Interface:</h4>
                                <ul className="text-sm space-y-1 text-gray-600">
                                    <li>• Navigate hierarchical structure</li>
                                    <li>• View match confidence scores</li>
                                    <li>• Identify validation issues</li>
                                    <li>• Monitor progress by state/round</li>
                                    <li>• Export when 100% validated</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
