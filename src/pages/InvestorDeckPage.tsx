import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  TrendingUp, 
  Layers, 
  Users, 
  Activity, 
  CheckCircle2, 
  ShieldCheck, 
  Megaphone,
  Briefcase,
  AlertTriangle,
  Lightbulb,
  DollarSign
} from 'lucide-react';

interface Slide {
  id: number;
  category: string;
  title: string;
  subtitle?: string;
  icon: any;
  content: React.ReactNode;
}

export const InvestorDeckPage = () => {
  const [currentSlideIndex, setCurrentSlideIndex] = React.useState(0);
  const [isDownloading, setIsDownloading] = React.useState(false);

  const downloadPdf = async () => {
    try {
      setIsDownloading(true);
      // Trigger a direct browser file download from our Express endpoint
      const response = await fetch('/api/investor-deck/pdf');
      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ChatFlow_Investor_Pitch.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('An error occurred while generating the PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const slides: Slide[] = [
    {
      id: 0,
      category: "Introduction",
      title: "ChatFlow",
      subtitle: "The Future of B2B Customer Support Automation",
      icon: Sparkles,
      content: (
        <div className="flex flex-col md:flex-row items-center gap-8 py-4">
          <div className="flex-1 space-y-4">
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
              Scaling Business Conversations Intelligently
            </h3>
            <p className="text-gray-600 leading-relaxed">
              ChatFlow is built to unify direct web widgets, WhatsApp automation pipelines, and native business action engines. We solve the fragmentation of modern corporate channels, offering small-to-medium businesses high-converting, automated support ecosystems.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-50">
                <div className="text-indigo-600 font-bold text-lg">Omnichannel</div>
                <div className="text-xs text-gray-500 mt-1">Unified Web & WhatsApp support</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-50">
                <div className="text-emerald-600 font-bold text-lg">Fact-Constrained</div>
                <div className="text-xs text-gray-500 mt-1">Zero hallucinations using RAG</div>
              </div>
            </div>
          </div>
          <div className="w-56 h-56 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-xl flex-shrink-0 animate-pulse">
            <div className="text-center">
              <div className="text-4xl font-extrabold tracking-widest">SEED</div>
              <div className="text-[10px] tracking-widest mt-1 opacity-80 uppercase">Pitch Deck</div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 1,
      category: "The Market Problem",
      title: "Fragile Channels & Massive Expenses",
      subtitle: "The Growing Pain of Small and Medium Businesses",
      icon: AlertTriangle,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-2">
          <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-gray-900">1. Fragmented Silos</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Businesses lose organic leads daily because support inquiries are scattered across disjointed websites, active cellphones, and custom WhatsApp setups.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-gray-900">2. Severe Costs</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Hiring around-the-clock support professionals to answer consistent routine queries is completely out of reach for growing middle-market businesses.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-gray-900">3. Hallucinating Bots</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              Generic, unaligned AI assistants cook up false facts, discount numbers, or product details, presenting massive legal and brand safety challenges.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 2,
      category: "The Solution",
      title: "Centralized Conversational Control",
      subtitle: "Unifying Direct Web Widgets and Native WhatsApp integration",
      icon: Lightbulb,
      content: (
        <div className="flex flex-col md:flex-row gap-6 py-2">
          <div className="flex-1 p-6 rounded-2xl bg-indigo-50/40 border border-indigo-50 space-y-3">
            <h4 className="font-bold text-indigo-900 text-lg">Integrated Web Widget</h4>
            <p className="text-sm text-indigo-950/70 leading-relaxed">
              Copy-paste an elegant script onto any HTML template to launch a custom-themed support widget instantly. Fully supports real-time synchronization, helpful links, and reservation workflows.
            </p>
            <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold pt-1">
              <CheckCircle2 className="w-4 h-4" /> Customized Design Accents
            </div>
          </div>
          <div className="flex-1 p-6 rounded-2xl bg-indigo-950 text-white space-y-3">
            <h4 className="font-bold text-indigo-200 text-lg">Dynamic WhatsApp Gateway</h4>
            <p className="text-sm text-indigo-200/70 leading-relaxed">
              Route incoming WhatsApp events (via WaSender webhook callbacks) straight to your designated workspace. Leverages local database-backed secret safety checkpoints to assure bulletproof transaction routing.
            </p>
            <div className="flex items-center gap-2 text-xs text-indigo-300 font-semibold pt-1">
              <ShieldCheck className="w-4 h-4" /> Custom Developer/Workspace API Keys
            </div>
          </div>
        </div>
      )
    },
    {
      id: 3,
      category: "Technology",
      title: "Infallible Knowledge: Document RAG",
      subtitle: "Retrieval-Augmented Generation for Pinpoint Accuracy",
      icon: Layers,
      content: (
        <div className="space-y-6 py-2">
          <p className="text-gray-600 text-sm">
            We bypass false AI responses. By dividing uploaded documents into high-efficiency knowledge fragments (embeddings) parsed by vector matches (Pinecone), we construct a context bubble that constrains Gemini.
          </p>
          <div className="relative pl-6 border-l-2 border-indigo-500 space-y-4">
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center" />
              <h5 className="font-bold text-gray-950 text-xs">Acknowledge Context First</h5>
              <p className="text-xs text-gray-500 mt-0.5">Managers drag in PDFs & spreadsheets. The pipeline reads the contents instantly without servers.</p>
            </div>
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center" />
              <h5 className="font-bold text-gray-950 text-xs">Vector Fact Finding</h5>
              <p className="text-xs text-gray-500 mt-0.5">When users message, Pinecone index scans isolated sections related directly to current customer intent.</p>
            </div>
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center" />
              <h5 className="font-bold text-gray-950 text-xs">Inference Constraints</h5>
              <p className="text-xs text-gray-500 mt-0.5">Gemini constructs natural answers containing ONLY compiled documentation. 100% brand safety.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 4,
      category: "Operations",
      title: "Operational Power: Native Reservations",
      subtitle: "Taking Actions directly in the Core Database",
      icon: Activity,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
          <div className="space-y-4">
            <h4 className="text-xl font-bold text-gray-900 tracking-tight">From Chat to Transaction</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              We prove platform extensibility through a fully functional reservation system. ChatFlow doesn't just discuss appointments - it books tables, organizes inventories, and synchronizes reservation slots seamlessly.
            </p>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-3">
              <CheckCircle2 className="text-emerald-500 w-5 h-5 flex-shrink-0" />
              <span className="text-xs text-gray-600 font-medium">Auto-books seats through WhatsApp and dynamic Webchat queries</span>
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-indigo-50/30 border border-indigo-100 flex flex-col justify-center space-y-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
              <div className="text-xs font-bold text-gray-800">Restaurant Booking</div>
              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full">CONFIRMED</span>
            </div>
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
              <div className="text-xs font-bold text-gray-800">Dynamic Synchronization</div>
              <span className="bg-indigo-100 text-indigo-800 text-[9px] font-bold px-2 py-0.5 rounded-full">LIVE</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 5,
      category: "Business Case",
      title: "Strong Economics & Seed Funding Ask",
      subtitle: "The Investment Case and SME Growth Horizons",
      icon: DollarSign,
      content: (
        <div className="space-y-6 py-2">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white border border-gray-100 text-center shadow-xs">
              <div className="text-indigo-600 font-extrabold text-lg">$49/mo</div>
              <div className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">Starter Tier</div>
            </div>
            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 text-center shadow-xs">
              <div className="text-indigo-700 font-extrabold text-lg">$149/mo</div>
              <div className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5">Growth Tier</div>
            </div>
            <div className="p-4 rounded-xl bg-indigo-950 text-white text-center shadow-xs">
              <div className="text-indigo-200 font-extrabold text-lg">Custom</div>
              <div className="text-[10px] text-indigo-300/80 font-semibold uppercase mt-0.5">Enterprise</div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-sm text-gray-950">Scale Goals & Capital Deployment</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              ChatFlow runs containerized on Cloud Run with zero-idle scaling. This allows spectacular 88%+ gross SaaS margins. Funding will accelerate B2B marketplace marketing, developer tools expansion, and direct integrations into global payment processors.
            </p>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
    }
  };

  const CurrentIcon = slides[currentSlideIndex].icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-indigo-600" />
            Investor Presentation Hub
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            Browse through the high-level business pitch deck, or export the document directly as a print-ready PDF file.
          </p>
        </div>
        <button
          onClick={downloadPdf}
          disabled={isDownloading}
          className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-100 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto justify-center"
        >
          {isDownloading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {isDownloading ? 'Building PDF...' : 'Download Pitch PDF'}
        </button>
      </div>

      {/* Main Slide Viewer Container */}
      <div className="relative min-h-[460px] bg-white rounded-3xl border border-gray-100 shadow-md overflow-hidden flex flex-col">
        {/* Progress Tracer */}
        <div className="w-full bg-gray-50 h-1.5 flex">
          {slides.map((_, idx) => (
            <div 
              key={idx}
              className={`flex-1 transition-all duration-300 ${
                idx <= currentSlideIndex ? 'bg-indigo-600' : 'bg-gray-100'
              }`}
            />
          ))}
        </div>

        {/* Slide Header area */}
        <div className="p-6 bg-gray-50/50 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <CurrentIcon className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest text-indigo-600 uppercase">
                {slides[currentSlideIndex].category}
              </span>
              <h2 className="text-base font-bold text-gray-900">
                {slides[currentSlideIndex].title}
              </h2>
            </div>
          </div>
          <span className="text-xs font-mono bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full font-bold">
            0{slides[currentSlideIndex].id + 1} / 0{slides.length}
          </span>
        </div>

        {/* Dynamic Content Frame */}
        <div className="p-8 flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlideIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              {slides[currentSlideIndex].subtitle && (
                <div className="text-gray-400 text-xs font-medium tracking-tight mb-4 uppercase">
                  {slides[currentSlideIndex].subtitle}
                </div>
              )}
              {slides[currentSlideIndex].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Slide navigation footer */}
        <div className="p-6 border-t border-gray-50 flex items-center justify-between bg-gray-50/30">
          <button
            onClick={handlePrev}
            disabled={currentSlideIndex === 0}
            className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-100 text-gray-600 rounded-xl font-medium text-xs hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:hover:bg-white"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          
          <div className="hidden sm:flex gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  idx === currentSlideIndex ? 'bg-indigo-600 w-5' : 'bg-gray-200 hover:bg-gray-300'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={currentSlideIndex === slides.length - 1}
            className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-100 text-gray-600 rounded-xl font-medium text-xs hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:hover:bg-white"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
