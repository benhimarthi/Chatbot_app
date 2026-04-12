import { Link } from 'react-router-dom';
import { Bot, Zap, Shield, Globe, ArrowRight, Check } from 'lucide-react';
import { CustomButton as Button, Card } from './components/UI';
import { motion } from 'motion/react';
import { cn } from './lib/utils';
import { AuthModal } from './components/AuthModal';
import * as React from 'react';

export const LandingPage = () => {
  console.log('LandingPage rendering');
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

  React.useEffect(() => {
    console.log('LandingPage mounted');
  }, []);

  return (
    <div className="min-h-screen bg-white selection:bg-indigo-100">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      
      {/* Navbar */}
      <nav className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Bot className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-gray-900">ChatFlow</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900">Features</a>
          <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900">Pricing</a>
          <Link to="/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900">Dashboard</Link>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setIsAuthModalOpen(true)}>Log in</Button>
          <Button size="sm" onClick={() => setIsAuthModalOpen(true)}>Get Started</Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold tracking-wider uppercase mb-6">
            Introducing ChatFlow 2.0
          </span>
          <h1 className="text-6xl md:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-8">
            Build Your AI Chatbot <br />
            <span className="text-indigo-600">in Minutes.</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload your documents, train your custom AI, and let it answer your customers automatically. No coding required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto gap-2" onClick={() => setIsAuthModalOpen(true)}>
              Start Building Free <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
              View Live Demo
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-gray-50 py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything you need to automate support</h2>
            <p className="text-gray-500">Powerful features to help you scale your customer interactions.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Upload Documents", desc: "Simply drag and drop your PDFs, docs, or paste URLs to train your AI instantly." },
              { icon: Shield, title: "Train Your AI", desc: "Fine-tune responses with custom instructions and specific business knowledge." },
              { icon: Globe, title: "Embed Anywhere", desc: "Add your chatbot to your website with a single line of code or use our API." },
            ].map((feature, i) => (
              <Card key={i} hover className="border-none shadow-sm">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-500">Choose the plan that's right for your business.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "Free", price: "$0", features: ["1 Chatbot", "10 Documents", "100 Messages/mo", "Standard Support"] },
              { name: "Starter", price: "$29", features: ["3 Chatbots", "50 Documents", "2,000 Messages/mo", "Priority Support", "Custom Branding"], popular: true },
              { name: "Pro", price: "$99", features: ["Unlimited Chatbots", "500 Documents", "10,000 Messages/mo", "24/7 Support", "API Access", "Analytics"] },
            ].map((plan, i) => (
              <Card key={i} className={cn("relative", plan.popular && "border-indigo-600 ring-1 ring-indigo-600")}>
                {plan.popular && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-indigo-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant={plan.popular ? "primary" : "secondary"} className="w-full">
                  Get Started
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
              <Bot className="text-white w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight text-gray-900">ChatFlow</span>
          </div>
          <p className="text-sm text-gray-500">© 2026 ChatFlow AI. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900">Privacy</a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900">Terms</a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
