'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { dataQuery } from '@/lib/org-data';
import {
  FileText,
  Users,
  BarChart3,
  ShoppingCart,
  MessageSquare,
  Shield,
  Zap,
  Globe,
  Check,
  ArrowRight,
  Menu,
  X,
  Building2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Plan {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_employees: number;
  max_suppliers: number;
  max_rfqs_per_month: number;
  max_purchase_orders: number;
  features: string[];
  sort_order: number;
}

export default function LandingPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await dataQuery('subscription_plans', {
          select: '*',
          eq: { is_active: true },
          order: { column: 'sort_order', ascending: true },
        });
        setPlans(data as Plan[]);
      } catch {}
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-foreground">RFQ Manager</span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it works</a>
              {user ? (
                <Link href="/app/dashboard">
                  <Button size="sm">Go to Dashboard <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
                </Link>
              ) : (
                <div className="flex items-center gap-3">
                  <Link href="/login">
                    <Button variant="ghost" size="sm">Sign In</Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm">Get Started</Button>
                  </Link>
                </div>
              )}
            </div>

            <button
              className="md:hidden text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#pricing" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#how-it-works" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>How it works</a>
              {user ? (
                <Link href="/app/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="sm" className="w-full">Go to Dashboard</Button>
                </Link>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full">Sign In</Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button size="sm" className="w-full">Get Started</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] opacity-50" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5" />
            The all-in-one procurement platform
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight animate-slide-up">
            Manage your <span className="text-primary">procurement</span>
            <br />
            from request to delivery
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
            RFQ Manager helps companies streamline their purchasing process. Create RFQs,
            send them to suppliers, compare offers, and generate purchase orders — all in one place.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Start Free Trial <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Explore Features
              </Button>
            </a>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-success" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-success" /> 14-day free trial</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-success" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: FileText, label: 'RFQs Created', value: '50,000+' },
              { icon: Users, label: 'Active Suppliers', value: '12,000+' },
              { icon: Building2, label: 'Companies', value: '500+' },
              { icon: TrendingUp, label: 'Avg. Cost Savings', value: '23%' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 mb-3">
                  <stat.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Everything you need to manage procurement</h2>
            <p className="mt-3 text-muted-foreground">Powerful features designed for procurement teams of any size</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: FileText, title: 'RFQ Management', desc: 'Create and send Request for Quotations to multiple suppliers with a few clicks. Track responses in real-time.' },
              { icon: Users, title: 'Supplier Management', desc: 'Maintain a centralized database of suppliers with contact info, categories, and performance history.' },
              { icon: ShoppingCart, title: 'Purchase Orders', desc: 'Generate professional purchase orders from accepted offers. Track PO status from draft to delivery.' },
              { icon: BarChart3, title: 'Advanced Analytics', desc: 'Get insights into spending patterns, supplier performance, and procurement cycle times.' },
              { icon: MessageSquare, title: 'WhatsApp Integration', desc: 'Send RFQs via WhatsApp and receive supplier responses directly in the platform.' },
              { icon: Shield, title: 'Role-Based Access', desc: 'Control who sees what with granular roles: admin, manager, and purchasing staff.' },
              { icon: Globe, title: 'Multi-Language', desc: 'Full Arabic and English support with RTL layout. Perfect for Middle East procurement teams.' },
              { icon: Zap, title: 'Google Sheets Sync', desc: 'Sync your data with Google Sheets for backup and reporting. Keep everything in sync automatically.' },
              { icon: Building2, title: 'Multi-Tenant', desc: 'Each company gets isolated data with custom branding. Secure and scalable SaaS architecture.' },
            ].map((feature, i) => (
              <Card key={i} className="p-6 hover:shadow-lg transition-shadow border-border">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 mb-4">
                  <feature.icon className="w-5.5 h-5.5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1.5">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">How it works</h2>
            <p className="mt-3 text-muted-foreground">From request to purchase order in four simple steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Create RFQ', desc: 'Add items, quantities, and specifications to create a new RFQ.' },
              { step: '02', title: 'Send to Suppliers', desc: 'Select suppliers and send the RFQ via email or WhatsApp.' },
              { step: '03', title: 'Compare Offers', desc: 'Review supplier offers side-by-side and select the best one.' },
              { step: '04', title: 'Generate PO', desc: 'Create a purchase order from the accepted offer and send it.' },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-4xl font-bold text-primary/20 mb-2">{item.step}</div>
                <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
                {i < 3 && (
                  <div className="hidden md:block absolute top-6 -right-4 text-border">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Simple, transparent pricing</h2>
            <p className="mt-3 text-muted-foreground">Choose the plan that fits your team. Upgrade or downgrade anytime.</p>

            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted mt-6">
              <button
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${billingCycle === 'monthly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setBillingCycle('monthly')}
              >
                Monthly
              </button>
              <button
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${billingCycle === 'yearly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setBillingCycle('yearly')}
              >
                Yearly
                <span className="ml-1.5 text-xs text-success">Save 17%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
              const isPro = plan.name === 'Pro';
              return (
                <Card
                  key={plan.id}
                  className={`relative p-6 flex flex-col ${isPro ? 'border-primary ring-2 ring-primary/20 shadow-lg' : 'border-border'}`}
                >
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      Most Popular
                    </div>
                  )}

                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  {plan.name_ar && <p className="text-sm text-muted-foreground">{plan.name_ar}</p>}
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>

                  <div className="mt-4 mb-6">
                    <span className="text-4xl font-bold text-foreground">${price}</span>
                    <span className="text-sm text-muted-foreground">/{billingCycle === 'monthly' ? 'month' : 'year'}</span>
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link href="/register">
                    <Button className="w-full" variant={isPro ? 'default' : 'outline'}>
                      {plan.name === 'Free' ? 'Get Started' : `Start ${plan.name}`}
                    </Button>
                  </Link>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl bg-sidebar p-8 sm:p-12 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent" />
            <div className="relative">
              <h2 className="text-3xl font-bold text-sidebar-foreground">Ready to streamline your procurement?</h2>
              <p className="mt-3 text-sidebar-foreground/70 max-w-xl mx-auto">
                Join hundreds of companies using RFQ Manager to save time and money on procurement.
              </p>
              <Link href="/register">
                <Button size="lg" className="mt-6">
                  Start Your Free Trial <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-foreground">RFQ Manager</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
              <Link href="/admin/login" className="hover:text-foreground transition-colors">Admin</Link>
            </div>
            <p className="text-xs text-muted-foreground">© 2026 RFQ Manager. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
