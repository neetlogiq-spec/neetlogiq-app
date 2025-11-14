# Razorpay Integration Guide

Complete guide to setting up Razorpay payments for subscription management.

---

## 📋 Prerequisites

- Razorpay account (Sign up at https://razorpay.com)
- Supabase database setup complete
- Next.js application deployed

---

## 🔑 Step 1: Get Razorpay API Keys

### Test Mode (Development)
Your test credentials are already configured:

```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_RfEUcdWWMEdZnk
RAZORPAY_KEY_SECRET=66S4hYnPAir6EkSuWvyXcZQD
```

### Production Mode

1. **Login to Razorpay Dashboard**: https://dashboard.razorpay.com
2. **Navigate to Settings → API Keys**
3. **Generate Live Keys**:
   - Click "Generate Live Key"
   - Download and save securely
4. **Update `.env.local`**:
   ```env
   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxx
   RAZORPAY_KEY_SECRET=your_live_secret_here
   ```

⚠️ **NEVER commit live keys to Git!**

---

## 🎯 Step 2: Configure Webhooks

Webhooks notify your app about payment status changes (success, failure, refunds).

### Setup Webhook URL

1. **Go to**: Razorpay Dashboard → Settings → Webhooks
2. **Add New Webhook**:
   - **URL**: `https://your-domain.com/api/payment/webhook`
   - **Active Events**: Select:
     - `payment.captured`
     - `payment.failed`
     - `payment.refunded`
     - `subscription.activated` (if using Razorpay subscriptions)
     - `subscription.cancelled`
     - `subscription.charged`
3. **Save Webhook Secret**:
   - Copy the webhook secret shown
   - Add to `.env.local`:
     ```env
     RAZORPAY_WEBHOOK_SECRET=whsec_xxxxx
     ```

### Test Webhook Locally

For local testing, use ngrok:

```bash
# Install ngrok
npm install -g ngrok

# Start your Next.js app
npm run dev

# In another terminal, expose port 3500
ngrok http 3500

# Use the ngrok URL in Razorpay webhook settings
# Example: https://abc123.ngrok.io/api/payment/webhook
```

---

## 💳 Step 3: Test Payments

### Test Card Numbers

Razorpay provides test cards for different scenarios:

**Successful Payment:**
- Card: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date
- Name: Any name

**Failed Payment:**
- Card: `4000 0000 0000 0002`

**Authentication Required:**
- Card: `5200 0000 0000 0007`
- OTP: `1234`

### Test UPI

- UPI ID: `success@razorpay`
- Status: Will succeed

### Test Wallets

All test wallets will succeed automatically.

Full list: https://razorpay.com/docs/payments/payments/test-card-details/

---

## 🚀 Step 4: Integrate in Your App

### 4.1: Install Dependencies

```bash
npm install razorpay
```

Already done! ✅

### 4.2: Files Created

All integration files are ready:

**Backend:**
- ✅ `src/lib/razorpay.ts` - Configuration & helpers
- ✅ `src/app/api/payment/create-order/route.ts` - Create Razorpay order
- ✅ `src/app/api/payment/verify/route.ts` - Verify payment
- ✅ `src/app/api/payment/webhook/route.ts` - Handle webhooks

**Frontend:**
- ✅ `src/components/subscription/PricingPlans.tsx` - Pricing page
- ✅ `src/components/subscription/RazorpayCheckout.tsx` - Payment modal

### 4.3: Add to Your Pages

**Create Pricing Page:**

```tsx
// src/app/pricing/page.tsx
import PricingPlans from '@/components/subscription/PricingPlans';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PricingPlans />
    </div>
  );
}
```

**Add to Navigation:**

```tsx
// In your navigation component
<Link href="/pricing" className="...">
  Upgrade
</Link>
```

---

## 🧪 Step 5: Testing Flow

### Test the Complete Flow

1. **Start Development Server:**
   ```bash
   npm run dev
   ```

2. **Navigate to Pricing Page:**
   - http://localhost:3500/pricing

3. **Sign In:**
   - Use Google OAuth

4. **Select a Plan:**
   - Click "Subscribe Now" on Counseling or Premium

5. **Complete Payment:**
   - Use test card: `4111 1111 1111 1111`
   - CVV: `123`
   - Expiry: `12/25`

6. **Verify Success:**
   - Check Supabase `subscriptions` table
   - Check `user_profiles.subscription_tier`
   - Check `notifications` table for success message

### Check Payment in Dashboard

1. **Go to**: Razorpay Dashboard → Payments
2. **See Test Payment**: Should show in list
3. **Check Details**: Status should be "captured"

---

## 🔒 Step 6: Security Best Practices

### Environment Variables

```bash
# Production only
NEVER commit .env.local to Git
Use environment variables on hosting platform
Rotate keys if exposed
```

### Signature Verification

All payment responses are verified using HMAC SHA256:

```typescript
// Already implemented in src/lib/razorpay.ts
verifyPaymentSignature(orderId, paymentId, signature)
```

### Webhook Authentication

Webhooks are verified using webhook secret:

```typescript
verifyWebhookSignature(body, signature, secret)
```

---

## 📊 Step 7: Go Live Checklist

### Before Production

- [ ] Replace test keys with live keys
- [ ] Update webhook URL to production domain
- [ ] Test live payment with real card (small amount)
- [ ] Setup refund policy in Razorpay
- [ ] Enable 2FA on Razorpay account
- [ ] Configure settlement schedule
- [ ] Add GST details in Razorpay settings
- [ ] Setup email notifications in Razorpay
- [ ] Test webhook delivery
- [ ] Monitor first few payments closely

### Razorpay Activation

1. **Complete KYC**: Razorpay Dashboard → Settings → Profile
   - Business details
   - Bank account details
   - Business documents

2. **Approval Time**: 24-48 hours

3. **Activation**: You'll receive email when approved

### Settlement

- **Timeline**: T+3 days (3 business days after payment)
- **Bank Account**: Must match business name
- **Minimum**: ₹100 per settlement

---

## 🎨 Step 8: Customize Checkout

### Branding

Update Razorpay checkout theme:

```typescript
// In RazorpayCheckout.tsx
theme: {
  color: '#3B82F6',        // Primary color
  backdrop_color: '#000000' // Modal backdrop
}
```

### Prefill Customer Data

Already implemented:

```typescript
prefill: {
  name: user.displayName,
  email: user.email,
  contact: user.phone // Add if available
}
```

### Custom Success/Failure Messages

Update in `RazorpayCheckout.tsx` component.

---

## 📈 Step 9: Analytics & Monitoring

### Track Conversions

```typescript
// Add to payment success handler
gtag('event', 'purchase', {
  transaction_id: paymentId,
  value: amount,
  currency: 'INR',
  items: [{
    item_name: planName,
    price: amount
  }]
});
```

### Monitor Failures

Check `payment_failures` table:

```sql
SELECT * FROM payment_failures
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Revenue Dashboard

Create in Razorpay:
- Dashboard → Analytics
- View daily, weekly, monthly revenue
- Track success rates
- Monitor refunds

---

## 🛠️ Troubleshooting

### Common Issues

**1. "Key ID is incorrect"**
- Check environment variable is set
- Restart dev server after adding keys

**2. "Signature verification failed"**
- Check key secret matches
- Ensure no trailing spaces in .env

**3. "Webhook not received"**
- Check webhook URL is accessible
- Test with ngrok for local development
- Verify webhook secret is correct

**4. "Payment successful but subscription not activated"**
- Check webhook handler logs
- Manually verify in Supabase
- Check database RLS policies

### Debug Mode

Enable detailed logging:

```typescript
// Add to webhook handler
console.log('Webhook event:', JSON.stringify(event, null, 2));
```

### Get Help

- **Razorpay Support**: https://razorpay.com/support
- **Documentation**: https://razorpay.com/docs
- **Discord**: Join Razorpay community

---

## 💡 Pro Tips

### 1. Auto-Renewal

For automatic subscription renewal, use Razorpay Subscription API:
- https://razorpay.com/docs/api/subscriptions

### 2. Coupon Codes

Add discount support:

```typescript
// In create-order route
const discount = applyCoupon(couponCode);
const finalAmount = amount - discount;
```

### 3. Multiple Plans

Already supported! Add more plans in `subscription-plans.ts`.

### 4. Trial Period

Add 7-day free trial:

```typescript
// Check if user is new
const isNewUser = !user.subscription_history;
if (isNewUser) {
  // Activate trial instead of payment
}
```

### 5. Invoices

Generate PDF invoices after successful payment:
- Use libraries like `jspdf` or `pdfkit`
- Email to customer
- Store in Supabase storage

---

## 📞 Support

### Test Mode Support

For test mode issues:
- Check console logs
- Verify API keys
- Test with different cards

### Production Support

For live payments:
- Contact: support@razorpay.com
- Phone: 080-71176200
- Dashboard: Create support ticket

---

## 🎉 Success!

Your payment system is now ready! Users can:
- ✅ View pricing plans
- ✅ Subscribe with Razorpay
- ✅ Get instant access to premium features
- ✅ Receive payment confirmations
- ✅ Manage subscriptions

### Next Steps

1. **Test thoroughly** in development
2. **Get Razorpay live approval**
3. **Deploy to production**
4. **Monitor first payments**
5. **Celebrate** 🎊

---

## 📚 Additional Resources

- [Razorpay Docs](https://razorpay.com/docs)
- [Razorpay API Reference](https://razorpay.com/docs/api)
- [Test Cards](https://razorpay.com/docs/payments/payments/test-card-details)
- [Webhooks Guide](https://razorpay.com/docs/webhooks)
- [Security Best Practices](https://razorpay.com/docs/payments/security)
