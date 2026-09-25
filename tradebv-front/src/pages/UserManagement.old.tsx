// DEPRECATED: This file has been replaced by UserManagement.tsx with updated UI and better API integration
// TODO: Remove this file after confirming no dependencies
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

const UserManagement: React.FC = () => {
  const { t } = useLanguage();
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
    username: '',
    password: '',
    role: 'user' as 'user' | 'admin'
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
      const errorMessage = err.message || 'Failed to load users';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter users based on search and filters
  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.username.toLowerCase().includes(searchQuery.toLowerCase());

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
        password: newUser.password || null,
        role: newUser.role,
      });

      // Show success toast
      toast({
        title: 'User created',
        description: `User ${newUser.username} has been created successfully.`,
      });

      // If password was generated, show it to admin
      if (response.generated_plain_password) {
        toast({
          title: 'Generated Password',
          description: `Password: ${response.generated_plain_password}`,
          duration: 10000,
        });
      }

      // Reset form and reload users
      setNewUser({ username: '', password: '', role: 'user' });
      setShowAddUserModal(false);
      setCopiedPassword(false);
      await loadUsers();
    } catch (err: any) {
      toast({
        title: 'Error creating user',
        description: err.message || 'Failed to create user',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: 'active' | 'blocked') => {
    try {
      await userService.toggleUserStatus(userId, currentStatus);
      toast({
        title: 'Status updated',
        description: `User status changed to ${currentStatus === 'active' ? 'blocked' : 'active'}.`,
      });
      await loadUsers();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update user status',
        variant: 'destructive',
      });
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await userService.deleteUser(userId);
      toast({
        title: 'User deleted',
        description: 'User has been removed from the system.',
      });
      await loadUsers();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    return status === 'active' ? (
      <Badge className="bg-success text-success-foreground">Активний</Badge>
    ) : (
      <Badge className="bg-destructive text-destructive-foreground">Заблокований</Badge>
    );
  };

  const getRoleBadge = (role: string) => {
    return role === 'admin' ? (
      <Badge variant="outline" className="border-primary text-primary">
        <Shield className="w-3 h-3 mr-1" />
        Адміністратор
      </Badge>
    ) : (
      <Badge variant="outline">
        <Users className="w-3 h-3 mr-1" />
        Учасник
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatLastLogin = (lastLogin: string | null) => {
    if (!lastLogin) return 'Ніколи';
    const date = new Date(lastLogin);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return 'Зараз';
    if (hours < 24) return `${hours} год тому`;
    if (days < 7) return `${days} дн тому`;
    return formatDate(lastLogin);
  };

  return (
    <AdminLayout title="Управління користувачами" subtitle="Керування обліковими записами та правами доступу">
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Header - Mobile Responsive */}
        <div className="flex justify-end">
          <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 btn-touch">
                <UserPlus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Додати користувача</span>
                <span className="sm:hidden">Додати</span>
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Пошук користувачів..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Role Filter */}
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Фільтр за роллю" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всі ролі</SelectItem>
                  <SelectItem value="user">Учасники</SelectItem>
                  <SelectItem value="admin">Адміністратори</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Фільтр за статусом" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всі статуси</SelectItem>
                  <SelectItem value="active">Активні</SelectItem>
                  <SelectItem value="blocked">Заблоковані</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Список користувачів ({filteredUsers.length})</span>
              <Button variant="outline" size="sm" onClick={loadUsers} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Оновити
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
            <div className="hidden sm:block table-mobile">
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
                      <TableHead>ID</TableHead>
                      <TableHead>Ім'я користувача</TableHead>
                      <TableHead>Роль</TableHead>
                      <TableHead>Останній вхід</TableHead>
                      <TableHead>Симуляції</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Дії</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">{user.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{user.username}</div>
                              <div className="text-sm text-muted-foreground">
                                Створено: {formatDate(user.created_at)}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell className="text-sm">{formatLastLogin(user.last_login)}</TableCell>
                        <TableCell className="text-sm">{user.simulations_count}</TableCell>
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
                                  Переглянути профіль
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleUserStatus(user.id, user.status)}>
                                {user.status === 'active' ? (
                                  <>
                                    <Ban className="h-4 w-4 mr-2" />
                                    Заблокувати
                                  </>
                                ) : (
                                  <>
                                    <Shield className="h-4 w-4 mr-2" />
                                    Розблокувати
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteUser(user.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Видалити
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
          </CardContent>
        </Card>

        {/* Add User Modal */}
        <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Додати нового користувача</DialogTitle>
              <DialogDescription>Створіть новий обліковий запис користувача в системі</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="username">Ім'я користувача (Email)</Label>
                <Input
                  id="username"
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <Label htmlFor="role">Роль</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: 'user' | 'admin') => setNewUser({ ...newUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        Учасник
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center">
                        <Shield className="h-4 w-4 mr-2" />
                        Адміністратор
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="password">Пароль</Label>
                <div className="flex space-x-2">
                  <Input
                    id="password"
                    type="text"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Залиште порожнім для автогенерації"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={generatePassword} className="px-3">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyPassword}
                    disabled={!newUser.password}
                    className="px-3"
                  >
                    {copiedPassword ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {copiedPassword && <p className="text-sm text-success mt-1">Пароль скопійовано!</p>}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddUserModal(false);
                  setNewUser({ username: '', password: '', role: 'user' });
                  setCopiedPassword(false);
                }}
              >
                Скасувати
              </Button>
              <Button onClick={handleAddUser} disabled={!newUser.username || isLoading}>
                {isLoading ? 'Створення...' : 'Створити користувача'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default UserManagement;
