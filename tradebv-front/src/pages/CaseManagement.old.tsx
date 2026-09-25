// DEPRECATED: This file has been replaced by CaseManagement.tsx which uses real API services instead of mock data
// TODO: Remove this file after confirming no dependencies
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminLayout } from '@/layouts/AdminLayout';
import { Plus, Search, Filter, Play, BarChart3, Users, Clock, Edit, Trash2, TestTube2 } from "lucide-react";
import { mockTrainingCases, mockTestPersonas, type TrainingCase, type TestPersona } from "@/data/mockCases";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { AITestRunnerModal } from "@/components/AITestRunnerModal";

const CaseManagement = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('cases');
  const [aiTestModal, setAITestModal] = useState<{ isOpen: boolean; caseTitle: string }>({ isOpen: false, caseTitle: '' });

  const filteredCases = mockTrainingCases.filter(
    (case_) =>
      case_.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      case_.userDescription.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPersonas = mockTestPersonas.filter(
    (persona) =>
      persona.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      persona.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-success text-success-foreground';
      case 'Paused':
        return 'bg-warning text-warning-foreground';
      case 'Draft':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'HR': 'bg-blue-100 text-blue-800',
      'Customer Service': 'bg-green-100 text-green-800',
      'Leadership': 'bg-purple-100 text-purple-800',
      'Technical': 'bg-orange-100 text-orange-800',
      'Sales': 'bg-pink-100 text-pink-800',
      'General': 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const handleRunCase = (caseId: string) => {
    navigate(`/simulation/${caseId}`);
  };

  const handleRunAITest = (caseId: string) => {
    const trainingCase = mockTrainingCases.find(c => c.id === caseId);
    if (trainingCase) {
      setAITestModal({ isOpen: true, caseTitle: trainingCase.title });
    }
  };

  const handleEditCase = (caseId: string) => {
    navigate(`/admin-dashboard/case-management/editor/${caseId}`);
  };

  const handleDeleteCase = (caseId: string) => {
    // TODO: Implement delete functionality
    console.log('Deleting case:', caseId);
  };

  const handleEditPersona = (personaId: string) => {
    // TODO: Implement persona editing
    console.log('Editing persona:', personaId);
  };

  const handleDeletePersona = (personaId: string) => {
    // TODO: Implement delete functionality
    console.log('Deleting persona:', personaId);
  };

  return (
    <AdminLayout
      title="Управління кейсами"
      subtitle="Керування навчальними кейсами та тестовими персонами"
    >
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-end">
          <Button
            onClick={() => navigate('/admin-dashboard/case-management/editor')}
            className="bg-primary hover:bg-primary-hover text-primary-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            Створити кейс
          </Button>
        </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={selectedTab === 'cases' ? "Пошук кейсів..." : "Пошук персон..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Фільтри
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cases">Кейси ({filteredCases.length})</TabsTrigger>
              <TabsTrigger value="personas">Тестові персони ({filteredPersonas.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="cases" className="mt-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredCases.map((case_) => (
                  <Card key={case_.id} className="hover:shadow-medium transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg line-clamp-2">{case_.title}</CardTitle>
                        <Badge className={getStatusColor(case_.status)}>
                          {case_.status}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-3">
                        {case_.userDescription}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {case_.enrolledUsers}
                        </div>
                        <div className="flex items-center">
                          <BarChart3 className="w-4 h-4 mr-1" />
                          {case_.averageScore}%
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <PersonaAvatar
                          name={case_.persona.name}
                          size="sm"
                        />
                        <span className="text-sm text-muted-foreground">
                          {case_.persona.name}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleRunCase(case_.id)}
                          className="flex-1"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Запустити
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRunAITest(case_.id)}
                          className="flex-1"
                        >
                          <TestTube2 className="w-4 h-4 mr-1" />
                          ШІ-тест
                        </Button>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditCase(case_.id)}
                          className="flex-1"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Редагувати
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteCase(case_.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="personas" className="mt-6">
              <div className="mb-4">
                <Button 
                  onClick={() => {/* TODO: Implement add persona */}}
                  variant="outline"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Додати тестову персону
                </Button>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredPersonas.map((persona) => (
                  <Card key={persona.id} className="hover:shadow-medium transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-3">
                        <PersonaAvatar
                          src={persona.avatar}
                          name={persona.name}
                          emotion={persona.emotion}
                          size="md"
                        />
                        <div className="flex-1">
                          <CardTitle className="text-lg">{persona.name}</CardTitle>
                          <CardDescription>{persona.role}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Badge className={getCategoryColor(persona.category)}>
                          {persona.category}
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                          {persona.personality}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Цілі:</h4>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {persona.objectives.slice(0, 2).map((objective, index) => (
                            <li key={index}>• {objective}</li>
                          ))}
                          {persona.objectives.length > 2 && (
                            <li>• +{persona.objectives.length - 2} ще...</li>
                          )}
                        </ul>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditPersona(persona.id)}
                          className="flex-1"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Редагувати
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeletePersona(persona.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AITestRunnerModal
        isOpen={aiTestModal.isOpen}
        onClose={() => setAITestModal({ isOpen: false, caseTitle: '' })}
        caseTitle={aiTestModal.caseTitle}
      />
      </div>
    </AdminLayout>
  );
};

export default CaseManagement;