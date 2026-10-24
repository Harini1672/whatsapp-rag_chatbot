import { Link } from 'react-router-dom'
import { Bot, Zap, Shield, BarChart3, MessageSquare, FileText, Globe, Mic } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const features = [
  { icon: Bot, title: 'AI-Powered Responses', desc: 'RAG technology grounds every answer in your uploaded documents.' },
  { icon: MessageSquare, title: 'Real WhatsApp', desc: 'Native WhatsApp integration via WasenderAPI — no simulations.' },
  { icon: FileText, title: 'Document Knowledge Base', desc: 'Upload PDFs, Word docs, and text files to build your bot\'s knowledge.' },
  { icon: Globe, title: 'Multilingual', desc: 'Auto-detect and respond in English, Telugu, Hindi, and more.' },
  { icon: Mic, title: 'Voice Support', desc: 'Send and receive voice messages with full speech-to-text/TTS.' },
  { icon: Shield, title: 'Secure & Isolated', desc: 'Row-level security ensures each organization\'s data is fully isolated.' },
  { icon: BarChart3, title: 'Analytics', desc: 'Track message volume, feedback, and unanswered questions.' },
  { icon: Zap, title: 'Human Escalation', desc: 'Seamlessly hand off to a human agent when the bot can\'t help.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Nav */}
      <nav className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-lg">RAG ChatBot</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button>Get Started Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
          <Zap className="w-3.5 h-3.5" />
          Powered by RAG + WhatsApp
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
          Build a Smart WhatsApp Bot<br />
          <span className="text-indigo-600">From Your Own Documents</span>
        </h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
          Upload your FAQs, policies, or product guides. The AI answers your customers' WhatsApp messages using that exact knowledge — grounded, accurate, and instant.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link to="/register">
            <Button size="lg">Start Building for Free</Button>
          </Link>
          <Link to="/chat">
            <Button size="lg" variant="outline">Try the Demo</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 dark:bg-gray-900 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">
            Everything you need
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-12">
            A complete platform — no piecing together separate tools.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Upload Documents', desc: 'Upload your knowledge base — PDFs, Word docs, FAQ files. The system extracts, chunks, and indexes them automatically.' },
            { step: '02', title: 'Connect WhatsApp', desc: 'Link your WhatsApp number via WasenderAPI. Set your chatbot\'s name, personality, and language preferences.' },
            { step: '03', title: 'Answer Instantly', desc: 'When a customer messages on WhatsApp, the bot retrieves the most relevant content and generates a grounded, accurate response.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-4">
                {step}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 py-16 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
        <p className="text-indigo-200 mb-8">Free plan available. No credit card required.</p>
        <Link to="/register">
          <Button size="lg" variant="secondary">Create Your Chatbot</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>© 2026 RAG ChatBot. Built with React, FastAPI, Supabase, and Pinecone.</p>
      </footer>
    </div>
  )
}
