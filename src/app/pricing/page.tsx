import PricingPlans from '@/components/subscription/PricingPlans';

export const metadata = {
  title: 'Pricing Plans | NEETLogiq',
  description: 'Choose the perfect plan for your NEET counseling journey. Get access to premium features, real-time updates, and personalized recommendations.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PricingPlans />
    </div>
  );
}
