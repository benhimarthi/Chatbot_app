import { Link } from 'react-router-dom';
import { Zap, Shield, Globe, ArrowRight, Check } from 'lucide-react';
import { CustomButton as Button, Card } from './components/UI';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { AuthModal } from './components/AuthModal';
import * as React from 'react';

const BACKGROUND_IMAGES = [
  "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop"
];

const BackgroundCarousel = () => {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img 
            src={BACKGROUND_IMAGES[index]} 
            alt="Background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px]" />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export const LandingPage = () => {
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-white selection:bg-indigo-100">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      
      {/* Navbar - Sticky and Transparent to White */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <span className="font-bold text-xl tracking-tight text-gray-900">Chat<span className="text-indigo-600">Flow</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
            <Link to="/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Dashboard</Link>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setIsAuthModalOpen(true)}>Log in</Button>
            <Button size="sm" onClick={() => setIsAuthModalOpen(true)}>Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section with Carousel */}
      <section className="relative pt-24 pb-12 bg-white overflow-hidden">
        <div className="w-full px-4 md:px-8 lg:px-12">
          <div className="relative w-full border border-gray-100 rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl shadow-indigo-900/5 ring-1 ring-black/[0.02]">
            <BackgroundCarousel />
            
            <div className="relative z-10 py-12 md:py-20 px-6 md:px-12 text-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="max-w-3xl mx-auto"
              >
                <motion.span 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="inline-block px-4 py-1.5 bg-indigo-600 text-white rounded-full text-xs font-bold tracking-wider uppercase mb-8 shadow-lg shadow-indigo-200"
                >
                  Introducing ChatFlow 2.0
                </motion.span>
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                  className="text-4xl md:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-8 px-4"
                >
                  Build Your AI Chatbot <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">in Minutes.</span>
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="text-base md:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed font-medium"
                >
                  Upload your documents, train your custom AI, and let it answer your customers automatically. No coding required.
                </motion.p>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4"
                >
                  <Button size="lg" className="w-full sm:w-auto gap-2 shadow-xl shadow-indigo-200" onClick={() => setIsAuthModalOpen(true)}>
                    Start Building Free <ArrowRight className="w-5 h-5" />
                  </Button>
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto bg-white/90 backdrop-blur-sm border-gray-100">
                    View Live Demo
                  </Button>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-gray-50 py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything you need to automate support</h2>
            <p className="text-gray-500">Powerful features to help you scale your customer interactions.</p>
          </motion.div>
          
          <motion.div 
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.2
                }
              }
            }}
            className="grid md:grid-cols-3 gap-8"
          >
            {[
              { icon: Zap, title: "Upload Documents", desc: "Simply drag and drop your PDFs, docs, or paste URLs to train your AI instantly." },
              { icon: Shield, title: "Train Your AI", desc: "Fine-tune responses with custom instructions and specific business knowledge." },
              { icon: Globe, title: "Embed Anywhere", desc: "Add your chatbot to your website with a single line of code or use our API." },
            ].map((feature, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.6 } }
                }}
              >
                <Card hover className="border-none shadow-sm h-full group">
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 transition-colors duration-300"
                  >
                    <feature.icon className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors duration-300" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-500">Choose the plan that's right for your business.</p>
          </motion.div>
          
          <motion.div 
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.3
                }
              }
            }}
            className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto"
          >
            {[
              { 
                name: "Free", 
                price: "$0", 
                features: ["Unlimited Documents", "200 Messages/mo", "20 Bookings/mo", "Integrated Booking System"],
                isFree: true 
              },
              { 
                name: "Pro", 
                price: "$49", 
                features: ["Unlimited Documents", "5,000 Messages/mo", "1,000 Bookings/mo", "Priority AI Support", "Advanced Analytics"], 
                popular: true 
              },
            ].map((plan, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, scale: 0.95, y: 20 },
                  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6 } }
                }}
              >
                <Card className={cn(
                  "relative p-8 h-full transition-all duration-300", 
                  plan.popular ? "border-indigo-600 ring-1 ring-indigo-600 shadow-xl shadow-indigo-100 scale-105 md:scale-110 z-10" : "hover:shadow-md"
                )}>
                  {plan.popular && (
                    <motion.span 
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1, duration: 0.5 }}
                      className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg"
                    >
                      Most Popular
                    </motion.span>
                  )}
                  <div className="flex flex-col h-full">
                    <div className="mb-8">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{plan.name}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                        <span className="text-gray-500 font-medium">/month</span>
                      </div>
                    </div>
                    
                    <ul className="space-y-4 mb-10 flex-1">
                      {plan.features.map((f, j) => (
                        <li key={j} className="flex items-start gap-3 text-sm text-gray-600 leading-tight">
                          <div className="mt-0.5 w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-indigo-600" />
                          </div>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Button 
                      variant={plan.popular ? "primary" : "secondary"} 
                      className={cn("w-full font-bold h-12", plan.popular && "bg-indigo-600 hover:bg-indigo-700")}
                      onClick={() => setIsAuthModalOpen(true)}
                    >
                      {plan.isFree ? "Start Free" : "Upgrade to Pro"}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center">
            <span className="font-bold text-lg tracking-tight text-gray-900">Chat<span className="text-indigo-600">Flow</span></span>
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
