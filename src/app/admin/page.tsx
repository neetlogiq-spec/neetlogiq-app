import { redirect } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';

export const metadata = {
  title: 'Admin Dashboard | NEETLogiq',
  description: 'Manage colleges, courses, and cutoff data',
};

export default function AdminPage() {
  // In production, check if user is admin
  // For now, just render the dashboard

  return <AdminDashboard />;
}
