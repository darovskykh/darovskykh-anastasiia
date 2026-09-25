import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AdminLayout } from '@/layouts/AdminLayout';
import { TableLoadingSkeleton } from '@/components/LoadingStates';
import { NoUsersFound, NoSearchResults } from '@/components/EmptyStates';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  UserPlus,
  Shield,
  ShieldCheck,
  Ban,
  AlertCircle
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/userService';
import type { User } from '@/types/user';
import { formatShortDate } from '@/utils/dateTime';

const UserManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  // State management
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add user form state
  const [newUser, setNewUser] = useState({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    role: 'user' as 'user' | 'admin' | 'superadmin'
  });

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedUsers = await userService.listUsers();
      setUsers(fetchedUsers);
    } catch (err: any) {
      const errorMessage = err.message || t('users.toasts.errorLoading');
      setError(errorMessage);
      toast({
        title: t('users.toasts.error'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter users based on search and filters
  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    const fullName = user.first_name && user.last_name 
      ? `${user.first_name} ${user.last_name}`.toLowerCase()
      : '';
    const matchesSearch = user.username.toLowerCase().includes(searchLower) ||
                         fullName.includes(searchLower) ||
                         (user.first_name && user.first_name.toLowerCase().includes(searchLower)) ||
                         (user.last_name && user.last_name.toLowerCase().includes(searchLower));
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUser({ ...newUser, password });
  };

  const copyPassword = async () => {
    if (newUser.password) {
      await navigator.clipboard.writeText(newUser.password);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const handleAddUser = async () => {
    try {
      setIsLoading(true);
      const response = await userService.createUser({
        username: newUser.username,
        first_name: newUser.firstName || null,
        last_name: newUser.lastName || null,
        password: newUser.password || null,
        role: newUser.role,
      });

      toast({
        title: t('users.toasts.userCreated'),
        description: t('users.toasts.userCreatedDesc', { username: newUser.username }),
      });

      if (response.generated_plain_password) {
        toast({
          title: t('users.toasts.generatedPassword'),
          description: t('users.toasts.passwordDesc', { password: response.generated_plain_password }),
          duration: 10000,
        });
      }

      setNewUser({ firstName: '', lastName: '', username: '', password: '', role: 'user' });
      setShowAddUserModal(false);
      setCopiedPassword(false);
      await loadUsers();
    } catch (err: any) {
      toast({
        title: t('users.toasts.errorCreating'),
        description: err.message || t('users.toasts.errorCreating'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: 'active' | 'blocked') => {
    try {
      await userService.toggleUserStatus(userId, currentStatus);
      const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
      toast({
        title: t('users.toasts.statusUpdated'),
        description: t('users.toasts.statusUpdatedDesc', { status: t(`users.statuses.${newStatus}`) }),
      });
      await loadUsers();
    } catch (err: any) {
      // Check for 403 Forbidden (trying to block admin/superadmin)
      if (err.status === 403) {
        toast({
          title: t('users.toasts.error'),
          description: t('users.toasts.cannotBlockAdmin'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('users.toasts.error'),
          description: err.message || t('users.toasts.errorUpdating'),
          variant: 'destructive',
        });
      }
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm(t('users.confirmDelete'))) {
      return;
    }

    try {
      await userService.deleteUser(userId);
      toast({
        title: t('users.toasts.userDeleted'),
        description: t('users.toasts.userDeletedDesc'),
      });
      await loadUsers();
    } catch (err: any) {
      // Check for 403 Forbidden (trying to delete admin/superadmin)
      if (err.status === 403) {
        toast({
          title: t('users.toasts.error'),
          description: t('users.toasts.cannotDeleteAdmin'),
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('users.toasts.error'),
          description: err.message || t('users.toasts.errorDeleting'),
          variant: 'destructive',
        });
      }
    }
  };

  const getStatusBadge = (status: string) => {
    return status === 'active' ? (
      <Badge className="bg-success text-success-foreground">{t('users.statuses.active')}</Badge>
    ) : (
      <Badge className="bg-destructive text-destructive-foreground">{t('users.statuses.blocked')}</Badge>
    );
  };

  const getRoleBadge = (role: string) => {
    if (role === 'admin' || role === 'superadmin') {
      return (
        <Badge variant="outline" className="border-primary text-primary">
          <Shield className="w-3 h-3 mr-1" />
          {t('users.roles.admin')}
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline">
          <Users className="w-3 h-3 mr-1" />
          {t('users.roles.user')}
        </Badge>
      );
    }
  };

  const formatDate = (dateString: string) => {
    const locale = language === 'uk' ? 'uk-UA' : 'en-US';
    return formatShortDate(dateString, locale);
  };

  const formatLastLogin = (lastLogin: string | null) => {
    if (!lastLogin) return t('users.lastLogin.never');

    // Parse UTC time properly - if no 'Z' suffix, add it
    let dateStr = lastLogin;
    const hasTimezone = dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr);

    if (!hasTimezone) {
      if (dateStr.includes('T')) {
        dateStr = dateStr + 'Z';
      } else {
        dateStr = dateStr + 'T00:00:00Z';
      }
    }

    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return t('users.lastLogin.now');
    if (hours < 24) return t('users.lastLogin.hoursAgo', { count: hours });
    if (days < 7) return t('users.lastLogin.daysAgo', { count: days });
    return formatDate(lastLogin);
  };

  return (
    <AdminLayout 
      title={t('users.title')} 
      subtitle={t('users.subtitle')}
      headerActions={
        <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 btn-touch">
              <UserPlus className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">{t('users.addUser')}</span>
              <span className="sm:hidden">{t('users.addUserShort')}</span>
            </Button>
          </DialogTrigger>
        </Dialog>
      }
    >
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder={t('users.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 text-sm sm:text-base"
                />
              </div>

              {/* Role Filter */}
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder={t('users.filterByRole')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('users.allRoles')}</SelectItem>
                  <SelectItem value="user">{t('users.roles.user')}</SelectItem>
                  <SelectItem value="admin">{t('users.roles.admin')}</SelectItem>
                  <SelectItem value="superadmin">{t('users.roles.superadmin')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder={t('users.filterByStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('users.allStatuses')}</SelectItem>
                  <SelectItem value="active">{t('users.statuses.active')}</SelectItem>
                  <SelectItem value="blocked">{t('users.statuses.blocked')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-lg sm:text-xl">{t('users.userList')} ({filteredUsers.length})</span>
              <Button variant="outline" size="sm" onClick={loadUsers} disabled={isLoading} className="w-full sm:w-auto">
                <RefreshCw className={`h-4 w-4 mr-2 flex-shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
                {t('users.refresh')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Error State */}
            {error && (
              <div className="p-6 flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              {isLoading ? (
                <TableLoadingSkeleton />
              ) : filteredUsers.length === 0 ? (
                searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? (
                  <NoSearchResults />
                ) : (
                  <NoUsersFound />
                )
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[80px]">{t('users.table.id')}</TableHead>
                      <TableHead className="min-w-[200px]">{t('users.table.name')}</TableHead>
                      <TableHead className="min-w-[200px]">{t('users.table.email')}</TableHead>
                      <TableHead className="min-w-[120px]">{t('users.table.role')}</TableHead>
                      <TableHead className="min-w-[120px]">{t('users.table.lastLogin')}</TableHead>
                      <TableHead className="min-w-[100px]">{t('users.table.status')}</TableHead>
                      <TableHead className="text-right min-w-[80px]">{t('users.table.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">{user.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-3 min-w-0">
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarFallback>
                                {user.first_name && user.last_name
                                  ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
                                  : user.username.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="font-medium min-w-0 truncate">
                              {user.first_name && user.last_name
                                ? `${user.first_name} ${user.last_name}`
                                : t('users.table.noName')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground min-w-0 truncate">
                          {user.username}
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{formatLastLogin(user.last_login)}</TableCell>
                        <TableCell>{getStatusBadge(user.status)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="btn-touch">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link to={`/admin-dashboard/users/${user.id}`} className="flex items-center">
                                  <Eye className="h-4 w-4 mr-2" />
                                  {t('users.actions.viewProfile')}
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleUserStatus(user.id, user.status)}>
                                {user.status === 'active' ? (
                                  <>
                                    <Ban className="h-4 w-4 mr-2" />
                                    {t('users.actions.block')}
                                  </>
                                ) : (
                                  <>
                                    <Shield className="h-4 w-4 mr-2" />
                                    {t('users.actions.unblock')}
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteUser(user.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('users.actions.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Mobile Card List View */}
            <div className="sm:hidden p-3 space-y-3">
              {isLoading ? (
                <TableLoadingSkeleton />
              ) : filteredUsers.length === 0 ? (
                searchQuery || roleFilter !== 'all' || statusFilter !== 'all' ? (
                  <NoSearchResults />
                ) : (
                  <NoUsersFound />
                )
              ) : (
                filteredUsers.map((user) => (
                  <div key={user.id} className="border rounded-lg p-3 sm:p-4 bg-card">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback>
                          {user.first_name && user.last_name
                            ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
                            : user.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate text-sm">
                          {user.first_name && user.last_name
                            ? `${user.first_name} ${user.last_name}`
                            : t('users.table.noName')}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{user.username}</div>
                      </div>
                      {getStatusBadge(user.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground mb-3">
                      <div>
                        <div className="text-foreground text-sm font-medium">{t('users.table.role')}</div>
                        <div className="mt-1">{getRoleBadge(user.role)}</div>
                      </div>
                      <div>
                        <div className="text-foreground text-sm font-medium">{t('users.table.lastLogin')}</div>
                        <div className="mt-1">{formatLastLogin(user.last_login)}</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button asChild size="sm" className="w-full btn-touch text-sm">
                        <Link to={`/admin-dashboard/users/${user.id}`}>
                          {t('users.actions.viewProfile')}
                        </Link>
                      </Button>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 btn-touch text-xs"
                          onClick={() => toggleUserStatus(user.id, user.status)}
                        >
                          {user.status === 'active' ? t('users.actions.block') : t('users.actions.unblock')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 btn-touch text-destructive text-xs"
                          onClick={() => deleteUser(user.id)}
                        >
                          {t('users.actions.delete')}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add User Modal */}
        <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal}>
          <DialogContent className="sm:max-w-md max-w-[95vw]">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">{t('users.modal.addTitle')}</DialogTitle>
              <DialogDescription className="text-sm">{t('users.modal.addDescription')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-sm">{t('users.modal.firstName')}</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    placeholder={t('users.modal.firstNamePlaceholder')}
                    className="text-sm sm:text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-sm">{t('users.modal.lastName')}</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    placeholder={t('users.modal.lastNamePlaceholder')}
                    className="text-sm sm:text-base"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="username" className="text-sm">{t('users.modal.username')}</Label>
                <Input
                  id="username"
                  type="email"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder={t('users.modal.usernamePlaceholder')}
                  className="text-sm sm:text-base"
                />
              </div>

              <div>
                <Label htmlFor="role" className="text-sm">{t('users.modal.role')}</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: 'user' | 'admin' | 'superadmin') => setNewUser({ ...newUser, role: value })}
                >
                  <SelectTrigger className="text-sm sm:text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        {t('users.roles.user')}
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center">
                        <Shield className="h-4 w-4 mr-2" />
                        {t('users.roles.admin')}
                      </div>
                    </SelectItem>
                    <SelectItem value="superadmin">
                      <div className="flex items-center">
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        {t('users.roles.superadmin')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="password" className="text-sm">{t('users.modal.password')}</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    id="password"
                    type="text"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder={t('users.modal.passwordPlaceholder')}
                    className="flex-1 text-sm sm:text-base"
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={generatePassword} className="px-3 flex-shrink-0">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={copyPassword}
                      disabled={!newUser.password}
                      className="px-3 flex-shrink-0"
                    >
                      {copiedPassword ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {copiedPassword && <p className="text-sm text-success mt-1">{t('users.modal.passwordCopied')}</p>}
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddUserModal(false);
                  setNewUser({ firstName: '', lastName: '', username: '', password: '', role: 'user' });
                  setCopiedPassword(false);
                }}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                {t('users.modal.cancel')}
              </Button>
              <Button 
                onClick={handleAddUser} 
                disabled={!newUser.username || isLoading}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {isLoading ? t('users.modal.creating') : t('users.modal.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default UserManagement;
