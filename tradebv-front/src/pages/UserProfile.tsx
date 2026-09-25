import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import {
  User as UserIcon,
  Save,
  Edit,
  Eye,
  Trash2,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Award,
  Calendar,
  Timer,
  BookOpen,
  AlertCircle,
  Copy,
  RefreshCw,
  Shield,
  ShieldCheck,
  Users as UsersIcon,
  ArrowLeft,
  FileText
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import { extractLocalizedContent } from '@/utils/localizedContent';
import { caseService } from '@/services/caseService';
import { useToast } from '@/hooks/use-toast';
import type { User, UserSessionRecording, SimulationHistoryItem } from '@/types/user';
import type { Case } from '@/types/case';
import { formatShortDate, formatDateTime, formatTime } from '@/utils/dateTime';

const UserProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { t, language, pluralize } = useLanguage();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  // Real user data from backend
  const [userData, setUserData] = useState<User | null>(null);
  const [assignedCases, setAssignedCases] = useState<Case[]>([]);
  const [sessionRecordings, setSessionRecordings] = useState<UserSessionRecording[]>([]);
  const [simulationHistory, setSimulationHistory] = useState<SimulationHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<User>>({});
  const [isEditingPermissions, setIsEditingPermissions] = useState(false);
  const [editedPermissions, setEditedPermissions] = useState<Partial<User>>({});
  const [showCaseSelectionDialog, setShowCaseSelectionDialog] = useState(false);
  const [allCases, setAllCases] = useState<Case[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const ALL_CASES = 0;

  // Load user data from backend
  useEffect(() => {
    if (userId) {
      loadUserData();
    }
  }, [userId]);

  const loadUserData = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const user = await userService.getUserById(userId);
      setUserData(user);
      setEditedData(user);
      setEditedPermissions(user);

      // Load all cases for the dropdowns and dialogs
      await loadAllCases();

      // Load assigned cases
      if (user.allowed_cases_ids.length > 0) {
        loadAssignedCases(user.allowed_cases_ids);
      }

      // Load session recordings
      loadSessionRecordings(userId);

      // Load simulation history
      loadSimulationHistory(userId);
    } catch (err: any) {
      toast({
        title: t('userProfile.toasts.error'),
        description: err.message || t('userProfile.toasts.loadError'),
        variant: 'destructive',
      });
      setUserData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getCaseExpiryStatus = (expiryDate: string | undefined) => {
    if (!expiryDate) return { color: 'gray', label: 'No expiry' };
    
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    
    if (diffMs < 0) return { color: 'red', label: 'Expired' };
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // Формируем строку
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    
    const label = `${parts.join(' ')} left`;
    
    // Определяем цвет
    const totalHours = diffMs / (1000 * 60 * 60);
    if (totalHours <= 24) return { color: 'red', label };
    if (totalHours <= 168) return { color: 'orange', label }; // 7 days
    if (totalHours <= 720) return { color: 'yellow', label }; // 30 days
    return { color: 'green', label };
  };

  const loadAssignedCases = async (caseIds: number[]) => {
    setIsLoadingCases(true);
    try {
      // Load all cases
      const allCases = (await caseService.listCases()).filter(c => !c.is_draft);
      setAllCases(allCases);

      // If caseIds contains ALL_CASES, show all cases
      if (caseIds.includes(ALL_CASES)) {
        setAssignedCases(allCases);
      } else {
        // Otherwise filter by specific IDs
        const filtered = allCases.filter(c => caseIds.includes(c.id));
        setAssignedCases(filtered);
      }
    } catch (err: any) {
      console.error('Failed to load assigned cases:', err);
    } finally {
      setIsLoadingCases(false);
    }
  };

  const loadSessionRecordings = async (userId: string) => {
    setIsLoadingRecordings(true);
    try {
      const recordings = await userService.getUserRecordings(userId);
      setSessionRecordings(recordings);
    } catch (err: any) {
      console.error('Failed to load session recordings:', err);
    } finally {
      setIsLoadingRecordings(false);
    }
  };

  const loadSimulationHistory = async (userId: string) => {
    setIsLoadingHistory(true);
    try {
      const history = await userService.getUserSimulationHistory(userId);
      setSimulationHistory(history);
    } catch (err: any) {
      console.error('Failed to load simulation history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showAssignCaseModal, setShowAssignCaseModal] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [timeLimitHours, setTimeLimitHours] = useState<number>(1000);
  
  const [recordingsPage, setRecordingsPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 5;
  const buildPaginationRange = (current: number, total: number, delta = 1): (number | 'ellipsis')[] => {
    if (total <= 0) return [];

    const siblingCount = Math.max(1, delta);
    const totalNumbersToShow = siblingCount * 2 + 5; // first, last, current, and ellipses

    if (total <= totalNumbersToShow) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const start = Math.max(2, current - siblingCount);
    const end = Math.min(total - 1, current + siblingCount);
    const range: (number | 'ellipsis')[] = [1];

    if (start > 2) {
      range.push('ellipsis');
    } else {
      for (let i = 2; i < start; i++) {
        range.push(i);
      }
    }

    for (let i = start; i <= end; i++) {
      range.push(i);
    }

    if (end < total - 1) {
      range.push('ellipsis');
    } else {
      for (let i = end + 1; i < total; i++) {
        range.push(i);
      }
    }

    range.push(total);
    return range;
  };

  // Load all cases when opening case selection dialog
  const loadAllCases = async () => {
    try {
      const cases = await caseService.listCases();
      setAllCases(cases);
    } catch (err: any) {
      toast({
        title: t('userProfile.toasts.error'),
        description: err.message || 'Failed to load cases',
        variant: 'destructive',
      });
    }
  };

  const openCaseSelectionDialog = async () => {
    await loadAllCases();
    // Filter out ALL_CASES when opening dialog for limited selection
    const currentIds = (editedPermissions.allowed_cases_ids || []).filter(id => id !== ALL_CASES);
    setSelectedCaseIds(currentIds);
    setShowCaseSelectionDialog(true);
  };

  const handleCaseSelectionSave = () => {
    setEditedPermissions({ ...editedPermissions, allowed_cases_ids: selectedCaseIds });
    setShowCaseSelectionDialog(false);
  };

  const toggleCaseSelection = (caseId: number) => {
    setSelectedCaseIds(prev =>
      prev.includes(caseId)
        ? prev.filter(id => id !== caseId)
        : [...prev, caseId]
    );
  };

  const selectAllCases = () => {
    setSelectedCaseIds(allCases.filter(c => !c.is_draft).map(c => c.id));
  };

  const deselectAllCases = () => {
    setSelectedCaseIds([]);
  };

  const handleSaveProfile = async () => {
    if (!userId || !userData) return;

    try {
      const updated = await userService.updateUser(userId, {
        first_name: editedData.first_name,
        last_name: editedData.last_name,
        username: editedData.username,
        role: editedData.role,
      });
      setUserData(updated);
      setIsEditing(false);
      toast({
        title: t('userProfile.toasts.success'),
        description: t('userProfile.toasts.profileUpdated'),
      });
    } catch (err: any) {
      toast({
        title: t('userProfile.toasts.error'),
        description: err.message || t('userProfile.toasts.profileUpdateError'),
        variant: 'destructive',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditedData(userData || {});
    setIsEditing(false);
  };

  const handleSavePermissions = async () => {
    if (!userId || !userData) return;

    try {
      // Format account_expiration_date: if provided, append time to make it end of day in UTC
      let formattedExpirationDate = editedPermissions.account_expiration_date;
      if (formattedExpirationDate && !formattedExpirationDate.includes('T')) {
        // If it's just a date (YYYY-MM-DD), append end of day time
        formattedExpirationDate = `${formattedExpirationDate}T23:59:59Z`;
      }

      const updated = await userService.updateUser(userId, {
        allowed_cases_ids: editedPermissions.allowed_cases_ids,
        account_expiration_date: formattedExpirationDate,
        max_simulations: editedPermissions.max_simulations,
      });
      setUserData(updated);
      setIsEditingPermissions(false);
      toast({
        title: t('userProfile.toasts.success'),
        description: t('userProfile.toasts.permissionsUpdated'),
      });

      // Reload assigned cases if they changed
      if (updated.allowed_cases_ids.length > 0) {
        loadAssignedCases(updated.allowed_cases_ids);
      } else {
        setAssignedCases([]);
      }
    } catch (err: any) {
      toast({
        title: t('userProfile.toasts.error'),
        description: err.message || t('userProfile.toasts.permissionsUpdateError'),
        variant: 'destructive',
      });
    }
  };

  const handleCancelPermissionsEdit = () => {
    setEditedPermissions(userData || {});
    setIsEditingPermissions(false);
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  const copyPassword = async () => {
    if (newPassword) {
      await navigator.clipboard.writeText(newPassword);
    }
  };

  const handleAssignCase = async () => {
    if (!userId || !selectedCaseId) return;

    try {
      const updatedUser = await userService.assignCaseToUser(userId, selectedCaseId, timeLimitHours);
      setUserData(updatedUser);
      setEditedPermissions(updatedUser);

      // Reload assigned cases
      if (updatedUser.allowed_cases_ids.length > 0) {
        loadAssignedCases(updatedUser.allowed_cases_ids);
      }

      setShowAssignCaseModal(false);
      setSelectedCaseId('');
      setTimeLimitHours(1000);

      toast({
        title: t('userProfile.toasts.success'),
        description: t('userProfile.toasts.caseAssigned'),
      });
    } catch (err: any) {
      toast({
        title: t('userProfile.toasts.error'),
        description: err.message || t('userProfile.toasts.caseAssignError'),
        variant: 'destructive',
      });
    }
  };

  const handleSavePassword = async () => {
    if (!userId || !newPassword) return;
    
    try {
      await userService.changeUserPassword(userId, newPassword);
      
      toast({
        title: t('userProfile.toasts.success'),
        description: t('userProfile.passwordModal.passwordChanged'),
      });
      
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (err: any) {
      toast({
        title: t('userProfile.toasts.error'),
        description: err.message || t('userProfile.passwordModal.passwordChangeError'),
        variant: 'destructive',
      });
    }
  };

  const handleUnassignCase = async (caseId: number) => {
    if (!userId) return;

    try {
      const updatedUser = await userService.unassignCaseFromUser(userId, caseId);
      setUserData(updatedUser);
      setEditedPermissions(updatedUser);

      // Reload assigned cases
      if (updatedUser.allowed_cases_ids.length > 0) {
        loadAssignedCases(updatedUser.allowed_cases_ids);
      } else {
        setAssignedCases([]);
      }

      toast({
        title: t('userProfile.toasts.success'),
        description: t('userProfile.toasts.caseUnassigned'),
      });
    } catch (err: any) {
      toast({
        title: t('userProfile.toasts.error'),
        description: err.message || t('userProfile.toasts.caseUnassignError'),
        variant: 'destructive',
      });
    }
  };

  const openAssignCaseModal = async () => {
    await loadAllCases();
    setShowAssignCaseModal(true);
  };


  const getStatusBadge = (completed_at: string | null) => {
    return completed_at !== null
      ? <Badge className="bg-success text-success-foreground"><CheckCircle className="w-3 h-3 mr-1" />{t('userProfile.history.completed')}</Badge>
      : <Badge className="bg-warning text-warning-foreground"><XCircle className="w-3 h-3 mr-1" />{t('userProfile.history.incomplete')}</Badge>;
  };

  const getScoreDisplay = (score: number | null) => {
    if (score === null) return <span className="text-muted-foreground">—</span>;
    
    const getScoreColor = (s: number) => {
      if (s >= 90) return 'text-success';
      if (s >= 80) return 'text-warning';
      if (s >= 70) return 'text-primary';
      return 'text-destructive';
    };

    return <span className={`font-semibold ${getScoreColor(score)}`}>{score}/100</span>;
  };

  const getPaginatedRecordings = () => {
    const startIndex = (recordingsPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sessionRecordings.slice(startIndex, endIndex);
  };

  const getPaginatedHistory = () => {
    const startIndex = (historyPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return simulationHistory.slice(startIndex, endIndex);
  };

  const totalRecordingsPages = Math.ceil(sessionRecordings.length / itemsPerPage);
  const totalHistoryPages = Math.ceil(simulationHistory.length / itemsPerPage);
  const recordingsPaginationRange = useMemo(
    () => buildPaginationRange(recordingsPage, totalRecordingsPages, 2),
    [recordingsPage, totalRecordingsPages]
  );
  const historyPaginationRange = useMemo(
    () => buildPaginationRange(historyPage, totalHistoryPages, 2),
    [historyPage, totalHistoryPages]
  );


  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">{t('userProfile.userNotFound')}</p>
            <Link to="/admin-dashboard/users">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('userProfile.backToList')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          <Link to="/admin-dashboard/users">
            <Button variant="outline" size="sm" className="flex-shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('userProfile.backToList')}</span>
              <span className="sm:hidden">{t('common.back')}</span>
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{t('userProfile.title')}</h1>
            <p className="text-muted-foreground text-sm sm:text-base truncate">
              {t('userProfile.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <Badge variant={userData.status === 'active' ? 'default' : 'destructive'} className="text-xs">
            {t(`userProfile.status.${userData.status}`)}
          </Badge>
          {(userData.role === 'admin' || userData.role === 'superadmin') && (
            <Badge variant="outline" className="border-primary text-primary text-xs">
              <Shield className="w-3 h-3 mr-1" />
              {t('userProfile.role.admin')}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="flex items-center space-x-2">
                  <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="text-lg sm:text-xl">{t('userProfile.basicInfo.title')}</span>
                </span>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="w-full sm:w-auto">
                    <Edit className="h-4 w-4 mr-2 flex-shrink-0" />
                    {t('userProfile.basicInfo.edit')}
                  </Button>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={handleCancelEdit} className="w-full sm:w-auto">
                      {t('userProfile.basicInfo.cancel')}
                    </Button>
                    <Button size="sm" onClick={handleSaveProfile} className="w-full sm:w-auto">
                      <Save className="h-4 w-4 mr-2 flex-shrink-0" />
                      {t('userProfile.basicInfo.save')}
                    </Button>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="firstName" className="text-sm">{t('userProfile.basicInfo.firstName')}</Label>
                <Input
                  id="firstName"
                  value={isEditing ? (editedData.first_name || '') : (userData.first_name || '')}
                  onChange={(e) => setEditedData({ ...editedData, first_name: e.target.value })}
                  disabled={!isEditing}
                  className="text-sm sm:text-base"
                />
              </div>

              <div>
                <Label htmlFor="lastName" className="text-sm">{t('userProfile.basicInfo.lastName')}</Label>
                <Input
                  id="lastName"
                  value={isEditing ? (editedData.last_name || '') : (userData.last_name || '')}
                  onChange={(e) => setEditedData({ ...editedData, last_name: e.target.value })}
                  disabled={!isEditing}
                  className="text-sm sm:text-base"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-sm">{t('userProfile.basicInfo.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={isEditing ? editedData.username : userData.username}
                  onChange={(e) => setEditedData({ ...editedData, username: e.target.value })}
                  disabled={!isEditing}
                  className="text-sm sm:text-base"
                />
              </div>

              <div>
                <Label htmlFor="role">{t('userProfile.basicInfo.role')}</Label>
                {isEditing ? (
                  <Select
                    value={editedData.role}
                    onValueChange={(value: 'user' | 'admin' | 'superadmin') => setEditedData({ ...editedData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">
                        <div className="flex items-center">
                          <UsersIcon className="h-4 w-4 mr-2" />
                          {t('userProfile.role.user')}
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center">
                          <Shield className="h-4 w-4 mr-2" />
                          {t('userProfile.role.admin')}
                        </div>
                      </SelectItem>
                      <SelectItem value="superadmin">
                        <div className="flex items-center">
                          <ShieldCheck className="h-4 w-4 mr-2" />
                          {t('userProfile.role.superadmin')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={t(`userProfile.role.${userData.role}`)} disabled />
                )}
              </div>

              <div>
                <Label>{t('userProfile.basicInfo.password')}</Label>
                <div className="flex space-x-2">
                  <Input type="password" value="••••••••••••" disabled />
                  <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>{t('userProfile.passwordModal.title')}</DialogTitle>
                        <DialogDescription>
                          {t('userProfile.passwordModal.subtitle')}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 py-4">
                        <div>
                          <Label htmlFor="newPassword">{t('userProfile.passwordModal.newPassword')}</Label>
                          <div className="flex space-x-2">
                            <Input
                              id="newPassword"
                              type="text"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder={t('userProfile.passwordModal.placeholder')}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={generatePassword}
                              className="px-3"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={copyPassword}
                              disabled={!newPassword}
                              className="px-3"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPasswordModal(false)}>
                          {t('userProfile.passwordModal.cancel')}
                        </Button>
                        <Button
                          onClick={handleSavePassword}
                          disabled={!newPassword}
                        >
                          {t('userProfile.passwordModal.save')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>{t('userProfile.basicInfo.id')}:</strong> {userData.id}</p>
                <p><strong>{t('userProfile.basicInfo.created')}:</strong> {formatShortDate(userData.created_at, language === 'uk' ? 'uk-UA' : 'en-US')}</p>
                <p><strong>{t('userProfile.basicInfo.lastLogin')}:</strong> {userData.last_login ? formatDateTime(userData.last_login, language === 'uk' ? 'uk-UA' : 'en-US') : t('userProfile.basicInfo.never')}</p>
                <p><strong>{t('userProfile.basicInfo.status')}:</strong> {t(`userProfile.status.${userData.status}`)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

          {/* Right Column */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Permissions Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>{t('userProfile.permissions.title')}</span>
                </span>
                {!isEditingPermissions ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingPermissions(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    {t('userProfile.basicInfo.edit')}
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={handleCancelPermissionsEdit}>
                      {t('userProfile.basicInfo.cancel')}
                    </Button>
                    <Button size="sm" onClick={handleSavePermissions}>
                      <Save className="h-4 w-4 mr-2" />
                      {t('userProfile.basicInfo.save')}
                    </Button>
                  </div>
                )}
              </CardTitle>
              <CardDescription className="text-sm">
                {t('userProfile.permissions.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="caseAccess">{t('userProfile.permissions.caseAccess')}</Label>
                  <div className="flex space-x-2">
                    <Select
                      value={
                        isEditingPermissions
                          ? (editedPermissions.allowed_cases_ids?.length === 0
                              ? "none"
                              : editedPermissions.allowed_cases_ids?.includes(ALL_CASES)
                                ? "all"
                                : "limited")
                          : (userData.allowed_cases_ids.length === 0
                              ? "none"
                              : userData.allowed_cases_ids.includes(ALL_CASES)
                                ? "all"
                                : "limited")
                      }
                      disabled={!isEditingPermissions}
                      onValueChange={async (value) => {
                        if (value === "none") {
                          setEditedPermissions({ ...editedPermissions, allowed_cases_ids: [] });
                        } else if (value === "all") {
                          setEditedPermissions({ ...editedPermissions, allowed_cases_ids: [ALL_CASES] });
                        } else if (value === "limited") {
                          await openCaseSelectionDialog();
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('userProfile.permissions.allCases')}</SelectItem>
                        <SelectItem value="limited">{t('userProfile.permissions.limitedCases', { count: isEditingPermissions ? (editedPermissions.allowed_cases_ids?.filter(id => id !== ALL_CASES).length || 0) : userData.allowed_cases_ids.filter(id => id !== ALL_CASES).length })}</SelectItem>
                        <SelectItem value="none">{t('userProfile.permissions.noCases')}</SelectItem>
                      </SelectContent>
                    </Select>
                    {isEditingPermissions && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openCaseSelectionDialog}
                        disabled={!isEditingPermissions}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="accountExpiry" className="text-sm">{t('userProfile.permissions.accountExpiry')}</Label>
                  <Input
                    id="accountExpiry"
                    type="date"
                    value={isEditingPermissions
                      ? (editedPermissions.account_expiration_date ? editedPermissions.account_expiration_date.split('T')[0] : '')
                      : (userData.account_expiration_date ? userData.account_expiration_date.split('T')[0] : '')
                    }
                    onChange={(e) => setEditedPermissions({ ...editedPermissions, account_expiration_date: e.target.value || null })}
                    disabled={!isEditingPermissions}
                  />
                </div>
                <div>
                  <Label htmlFor="launchLimit" className="text-sm">{t('userProfile.permissions.launchLimit')}</Label>
                  <Input
                    id="launchLimit"
                    type="number"
                    value={isEditingPermissions
                      ? (editedPermissions.max_simulations ?? '')
                      : (userData.max_simulations ?? '')
                    }
                    onChange={(e) => setEditedPermissions({ ...editedPermissions, max_simulations: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder={t('userProfile.permissions.noLimit')}
                    disabled={!isEditingPermissions}
                  />
                </div>
                <div>
                  <Label htmlFor="simulationsCount" className="text-sm">{t('userProfile.permissions.simulationsCount')}</Label>
                  <Input
                    id="simulationsCount"
                    type="number"
                    value={userData.simulations_count}
                    disabled
                    className="text-sm sm:text-base"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('userProfile.permissions.simulationsCountPlaceholder')}
                  </p>
                </div>
              </div>
              {!isEditingPermissions && (
                <p className="text-xs text-muted-foreground mt-4">
                  {t('userProfile.permissions.editNote')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Case Assignment */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="text-lg sm:text-xl truncate">{t('userProfile.assignedCases.title')}</span>
                </div>
                {!userData?.allowed_cases_ids.includes(ALL_CASES) && (
                  <Button size="sm" className="w-full sm:w-auto" onClick={openAssignCaseModal}>
                    <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
                    {t('userProfile.assignedCases.assignCase')}
                  </Button>
                )}
              </CardTitle>
              <CardDescription className="text-sm">
                {t('userProfile.assignedCases.subtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userData?.allowed_cases_ids.includes(ALL_CASES) && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center">
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {t('userProfile.assignedCases.allAccessNote')}
                  </p>
                </div>
              )}
              {isLoadingCases ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">{t('userProfile.assignedCases.loading')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assignedCases.map((assignedCase) => (
                    <div key={assignedCase.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{extractLocalizedContent(assignedCase.title, language)}</h4>
                          <Badge variant={assignedCase.is_draft ? "secondary" : "default"}>
                            {assignedCase.is_draft ? t('userProfile.assignedCases.draft') : t('userProfile.assignedCases.active')}
                          </Badge>
                          {userData.case_access_expiry && userData.case_access_expiry[assignedCase.id] && (() => {
                            const status = getCaseExpiryStatus(userData.case_access_expiry[assignedCase.id]);
                            return (
                              <span 
                                style={{ 
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  backgroundColor: 
                                    status.color === 'red' ? '#ffebee' :
                                    status.color === 'orange' ? '#fff3e0' :
                                    status.color === 'yellow' ? '#fffde7' :
                                    '#e8f5e9',
                                  color:
                                    status.color === 'red' ? '#c62828' :
                                    status.color === 'orange' ? '#ef6c00' :
                                    status.color === 'yellow' ? '#f57f17' :
                                    '#2e7d32'
                                }}
                              >
                                {status.label}
                              </span>
                            );
                          })()}
                          {/* КОНЕЦ БЛОКА */}
                        </div>
                        <div className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {extractLocalizedContent(assignedCase.intro_text || assignedCase.prompt || '', language)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {t('userProfile.assignedCases.created')}: {formatShortDate(assignedCase.created_at, language === 'uk' ? 'uk-UA' : 'en-US')}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/admin-dashboard/case-management/editor/${assignedCase.id}`, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!userData?.allowed_cases_ids.includes(ALL_CASES) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnassignCase(assignedCase.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  {assignedCases.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>{t('userProfile.assignedCases.noCases')}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Video/Audio Recordings - Full Width */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="text-lg sm:text-xl truncate">{t('userProfile.recordings.title')}</span>
            </div>
            {sessionRecordings.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {sessionRecordings.length} {pluralize(sessionRecordings.length, {
                  uk: { one: 'запис', few: 'записи', many: 'записів' },
                  ru: { one: 'запись', few: 'записи', many: 'записей' },
                  en: { one: 'recording', few: 'recordings', many: 'recordings' },
                  es: { one: 'grabación', few: 'grabaciones', many: 'grabaciones' },
                  pt: { one: 'gravação', few: 'gravações', many: 'gravações' },
                  ar: { one: 'تسجيل', few: 'تسجيلات', many: 'تسجيلات' },
                })}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-sm">
            {t('userProfile.recordings.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingRecordings ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">{t('userProfile.recordings.loading')}</p>
            </div>
          ) : (
            <>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {getPaginatedRecordings().map((recording) => {
                  const webcamUrl = recording.recording_url;
                  const screenUrl = recording.simulation_recording_url;
                  const recordingType = recording.has_video && recording.has_audio
                    ? t('userProfile.recordings.videoAudio')
                    : recording.has_video
                    ? t('userProfile.recordings.videoOnly')
                    : recording.has_audio
                    ? t('userProfile.recordings.audioOnly')
                    : '';

                  const webcamSize = recording.recording_size_bytes
                    ? `${(recording.recording_size_bytes / (1024 * 1024)).toFixed(2)} MB`
                    : '';
                  const screenSize = recording.simulation_recording_size_bytes
                    ? `${(recording.simulation_recording_size_bytes / (1024 * 1024)).toFixed(2)} MB`
                    : '';

                  const recordedAt = formatShortDate(recording.created_at, language === 'uk' ? 'uk-UA' : 'en-US');

                  return (
                    <div key={recording.chat_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-3">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium truncate">{recording.case_title ? extractLocalizedContent(recording.case_title, language) : recording.chat_name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {recordedAt}
                          </p>
                          <div className="text-xs text-muted-foreground flex flex-col sm:flex-row sm:gap-2">
                            {webcamUrl && (
                              <span>
                                {t('userProfile.recordings.webcamLabel')}
                                {webcamSize ? ` • ${webcamSize}` : ''}
                                {recordingType ? ` • ${recordingType}` : ''}
                              </span>
                            )}
                            {screenUrl && (
                              <span>
                                {t('userProfile.recordings.screenLabel')}
                                {screenSize ? ` • ${screenSize}` : ''}
                              </span>
                            )}
                          </div>
                          {
                            recording.status === 'incomplete' ? (
                              <Badge className="bg-warning text-warning-foreground text-xs mt-1">
                                {t('userProfile.recordings.incomplete')}
                              </Badge>
                            ) : (
                              <Badge className="bg-success text-success-foreground text-xs mt-1">
                                {t('userProfile.recordings.complete')}
                              </Badge>
                            )
                          }
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2 sm:flex-wrap">
                        {webcamUrl && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(webcamUrl, '_blank')}
                              className="w-full sm:w-auto"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              {t('userProfile.recordings.viewWebcam')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(webcamUrl);
                                toast({
                                  title: 'Success',
                                  description: 'Recording URL copied to clipboard',
                                });
                              }}
                              title={t('userProfile.recordings.copyLink')}
                              aria-label={t('userProfile.recordings.copyLink')}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {screenUrl && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(screenUrl, '_blank')}
                              className="w-full sm:w-auto"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              {t('userProfile.recordings.viewScreen')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(screenUrl);
                                toast({
                                  title: 'Success',
                                  description: 'Recording URL copied to clipboard',
                                });
                              }}
                              title={t('userProfile.recordings.copyLink')}
                              aria-label={t('userProfile.recordings.copyLink')}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {sessionRecordings.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t('userProfile.recordings.noRecordings')}</p>
                  </div>
                )}
              </div>

              {totalRecordingsPages > 1 && (
                <div className="mt-4 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setRecordingsPage(prev => Math.max(prev - 1, 1))}
                          className={recordingsPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {recordingsPaginationRange.map((page, index) => (
                        <PaginationItem key={`${page}-${index}`}>
                          {page === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setRecordingsPage(page)}
                              isActive={recordingsPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setRecordingsPage(prev => Math.min(prev + 1, totalRecordingsPages))}
                          className={recordingsPage === totalRecordingsPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Simulation History - Full Width */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Award className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="text-lg sm:text-xl truncate">{t('userProfile.history.title')}</span>
            </div>
            {simulationHistory.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {simulationHistory.length} {pluralize(simulationHistory.length, {
                  uk: { one: 'симуляція', few: 'симуляції', many: 'симуляцій' },
                  ru: { one: 'симуляция', few: 'симуляции', many: 'симуляций' },
                  en: { one: 'simulation', few: 'simulations', many: 'simulations' },
                  es: { one: 'simulación', few: 'simulaciones', many: 'simulaciones' },
                  pt: { one: 'simulação', few: 'simulações', many: 'simulações' },
                  ar: { one: 'محاكاة', few: 'محاكاة', many: 'محاكاة' },
                })}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-sm">
            {t('userProfile.history.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">{t('userProfile.history.loading')}</p>
            </div>
          ) : simulationHistory.length > 0 ? (
            <>
              <div className="max-h-96 overflow-y-auto">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">{t('userProfile.history.date')}</TableHead>
                        <TableHead className="min-w-[200px]">{t('userProfile.history.caseName')}</TableHead>
                        <TableHead className="min-w-[100px]">{t('userProfile.history.status')}</TableHead>
                        <TableHead className="min-w-[100px]">{t('userProfile.history.duration')}</TableHead>
                        <TableHead className="min-w-[80px]">{t('userProfile.history.score')}</TableHead>
                        <TableHead className="min-w-[200px]">{t('userProfile.history.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                    {getPaginatedHistory().map((sim) => {
                      const duration = sim.duration_seconds
                        ? `${Math.floor(sim.duration_seconds / 60)} ${t('userProfile.history.minLabel')} ${sim.duration_seconds % 60} ${t('userProfile.history.secLabel')}`
                        : '-';
                      const date = formatShortDate(sim.created_at, language === 'uk' ? 'uk-UA' : 'en-US');
                      const completionTime = sim.completed_at
                        ? formatTime(sim.completed_at, language === 'uk' ? 'uk-UA' : 'en-US')
                        : '';

                      return (
                        <TableRow key={sim.chat_id}>
                          <TableCell className="font-mono text-sm">
                            {date}
                            {completionTime && (
                              <div className="text-xs text-muted-foreground">{completionTime}</div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{sim.case_title ? extractLocalizedContent(sim.case_title, language) : ''}</TableCell>
                          <TableCell>{getStatusBadge(sim.completed_at)}</TableCell>
                          <TableCell>{duration}</TableCell>
                          <TableCell>{getScoreDisplay(sim.score)}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {sim.has_report && sim.report_status === 'ready' && (
                                sim.evaluation_confirmed ? (
                                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                                    {t('userProfile.history.confirmed')}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                                    {t('userProfile.history.pendingReview')}
                                  </Badge>
                                )
                              )}
                              {sim.has_report && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    navigate(`/simulation/${sim.chat_id}/results`);
                                  }}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  {t('userProfile.history.viewReport')}
                                </Button>
                              )}
                              {sim.has_recording && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      // Get the recording from session recordings
                                      const recording = sessionRecordings.find(r => r.chat_id === sim.chat_id);
                                      const recordingUrl = recording?.simulation_recording_url || recording?.recording_url;
                                      if (recordingUrl) {
                                        window.open(recordingUrl, '_blank');
                                      } else {
                                        toast({
                                          title: 'Error',
                                          description: 'Recording URL not found',
                                          variant: 'destructive',
                                        });
                                      }
                                    } catch (err) {
                                      toast({
                                        title: 'Error',
                                        description: 'Failed to open recording',
                                        variant: 'destructive',
                                      });
                                    }
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  {t('userProfile.history.viewRecording')}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalHistoryPages > 1 && (
                <div className="mt-4 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setHistoryPage(prev => Math.max(prev - 1, 1))}
                          className={historyPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      {historyPaginationRange.map((page, index) => (
                        <PaginationItem key={`${page}-${index}`}>
                          {page === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              onClick={() => setHistoryPage(page)}
                              isActive={historyPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setHistoryPage(prev => Math.min(prev + 1, totalHistoryPages))}
                          className={historyPage === totalHistoryPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('userProfile.history.noHistory')}</p>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Case Selection Modal */}
      <Dialog open={showCaseSelectionDialog} onOpenChange={setShowCaseSelectionDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('userProfile.caseSelection.title')}</DialogTitle>
            <DialogDescription>
              {t('userProfile.caseSelection.subtitle')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex space-x-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllCases}
            >
              {t('userProfile.caseSelection.selectAll')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAllCases}
            >
              {t('userProfile.caseSelection.deselectAll')}
            </Button>
            <div className="flex-1"></div>
            <Badge variant="secondary">
              {t('userProfile.caseSelection.selected')}: {selectedCaseIds.length}
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto border rounded-lg p-4 space-y-2">
            {allCases.filter(c => !c.is_draft).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t('userProfile.caseSelection.noCases')}</p>
              </div>
            ) : (
              allCases.filter(c => !c.is_draft).map((caseItem) => (
                <div
                  key={caseItem.id}
                  className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                    selectedCaseIds.includes(caseItem.id) ? 'bg-accent border-primary' : ''
                  }`}
                  onClick={() => toggleCaseSelection(caseItem.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedCaseIds.includes(caseItem.id)}
                    onChange={() => toggleCaseSelection(caseItem.id)}
                    onClick={(event) => event.stopPropagation()}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{extractLocalizedContent(caseItem.title, language)}</h4>
                    </div>
                    {caseItem.intro_text && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {extractLocalizedContent(caseItem.intro_text, language)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCaseSelectionDialog(false)}>
              {t('userProfile.caseSelection.cancel')}
            </Button>
            <Button onClick={handleCaseSelectionSave}>
              <Save className="h-4 w-4 mr-2" />
              {t('userProfile.caseSelection.save')} ({selectedCaseIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Case Modal */}
      <Dialog open={showAssignCaseModal} onOpenChange={setShowAssignCaseModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('userProfile.assignCaseModal.title')}</DialogTitle>
            <DialogDescription>
              {t('userProfile.assignCaseModal.subtitle')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="caseSelect">{t('userProfile.assignCaseModal.selectCase')}</Label>
              <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('userProfile.assignCaseModal.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {allCases
                    .filter(c => !userData?.allowed_cases_ids.includes(c.id) && !c.is_draft)
                    .map(caseItem => (
                      <SelectItem key={caseItem.id} value={caseItem.id}>
                        {extractLocalizedContent(caseItem.title, language)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="timeLimitHours">{t('userProfile.assignCaseModal.timeLimit')}</Label>
              <Input
                id="timeLimitHours"
                type="number"
                min="1"
                value={timeLimitHours}
                onChange={(e) => setTimeLimitHours(parseInt(e.target.value) || 1000)}
                placeholder="1000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('userProfile.assignCaseModal.timeLimitNote')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAssignCaseModal(false);
              setSelectedCaseId('');
              setTimeLimitHours(1000);
            }}>
              {t('userProfile.assignCaseModal.cancel')}
            </Button>
            <Button
              onClick={handleAssignCase}
              disabled={!selectedCaseId}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('userProfile.assignCaseModal.assign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserProfile;
