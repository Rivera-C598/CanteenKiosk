'use client'

import { Icon } from '@/components/shared/Icon'
import { useLanguage } from '@/lib/language-context'

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { t } = useLanguage()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/40 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-surface-container-lowest rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-slide-up flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Icon name="support_agent" size={40} className="text-primary" />
        </div>
        
        <h2 className="font-headline font-black text-2xl text-on-surface mb-3" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {t('help.title')}
        </h2>
        
        <p className="text-on-surface-variant font-medium mb-8">
          {t('help.desc')}
        </p>
        
        <button
          onClick={onClose}
          className="w-full bg-primary text-on-primary font-headline font-bold text-lg py-4 rounded-xl shadow-primary-glow active:scale-[0.98] transition-transform"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {t('help.close')}
        </button>
      </div>
    </div>
  )
}
