'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export type Language = 'en' | 'fil' | 'ceb'

type Dictionary = Record<string, string>

export const translations: Record<Language, Dictionary> = {
  en: {
    // welcome
    'welcome.favorites': 'Student Favorites',
    'welcome.fuel': 'FUEL YOUR',
    'welcome.strength': 'STRENGTH.',
    'welcome.desc': 'The ultimate campus dining experience. Freshly made, lightning fast, and student-budget friendly.',
    'welcome.tap': 'TAP HERE <br /> TO START',
    'welcome.budget': 'STUDENT BUDGET FRIENDLY',
    'welcome.help': 'Need help ordering?',
    'welcome.help_desc': 'Touch for assistance',
    'welcome.screensaver': 'Tap anywhere to order',
    // help modal
    'help.title': 'Need Assistance?',
    'help.desc': 'Please proceed to the cashier for assistance.',
    'help.close': 'Close',
    // menu
    'menu.loading': 'Loading menu...',
    'menu.back': 'Back',
    'menu.empty': 'No items in this category',
    'menu.soldout': 'SOLD OUT',
    'menu.view_order': 'View Order',
    // cart
    'cart.empty': 'Your cart is empty',
    'cart.browse': 'Browse Menu',
    'cart.back': 'Back to Menu',
    'cart.title': 'Your Order',
    'cart.items': 'item',
    'cart.items_plural': 'items',
    'cart.total': 'Total',
    'cart.proceed': 'Proceed to Payment',
    // payment
    'payment.title': 'Payment',
    'payment.back': 'Back',
    'payment.total': 'Order Total',
    'payment.cash': 'Cash',
    'payment.cash_desc': 'Pay at the counter',
    'payment.gcash': 'GCash',
    'payment.gcash_desc': 'Scan QR to pay',
    'payment.gcash_info': 'A QR code will be shown after you place your order. Scan with GCash app and send the exact amount. Staff will confirm your payment.',
    'payment.cash_info': 'Your order will be placed and you\'ll get an order number. Bring it to the counter and pay in cash.',
    'payment.button': 'Place Order',
    'payment.loading': 'Placing Order...',
    'payment.error': 'Something went wrong. Please try again.',
    // gcash flow
    'gcash.cancel': 'Cancel',
    'gcash.title': 'GCash Payment',
    'gcash.expired': 'Payment Time Expired',
    'gcash.expired_desc': 'Your order has been cancelled. Please start a new order.',
    'gcash.new_order': 'Start New Order',
    'gcash.send_exactly': 'Send exactly',
    'gcash.order': 'Order',
    'gcash.setup_admin': 'QR code will be set up by admin',
    'gcash.how_to': 'How to pay:',
    'gcash.step1': 'Open your GCash app',
    'gcash.step2': 'Tap "Pay QR" and scan the code above',
    'gcash.step3': 'Enter exactly',
    'gcash.step4': 'Confirm and send payment',
    'gcash.sent': "I've Sent Payment",
    // confirmed
    'confirmed.order_no': 'Order Number',
    'confirmed.cash_title': 'Please pay at the counter',
    'confirmed.cash_desc': 'Show this order number to the cashier and pay in cash.',
    'confirmed.gcash_title': 'Payment pending verification',
    'confirmed.gcash_desc': 'Staff will confirm your GCash payment. Watch the queue display for your order number.',
    'confirmed.wait': 'Estimated wait: 8–12 minutes',
    'confirmed.returning': 'Returning to home in',
  },
  fil: {
    // welcome
    'welcome.favorites': 'Paborito ng Estudyante',
    'welcome.fuel': 'BUSUGIN',
    'welcome.strength': 'ANG LAKAS',
    'welcome.desc': 'Ang pinaka-astig na kainan sa campus. Bagong luto, mabilis, at swak sa budget.',
    'welcome.tap': 'PINDUTIN DITO <br /> PARA MAGSIMULA',
    'welcome.budget': 'PANG-ESTUDYANTENG BUDGET',
    'welcome.help': 'Kailangan ng tulong?',
    'welcome.help_desc': 'Pindutin para matulungan',
    'welcome.screensaver': 'Pindutin kahit saan para umorder',
    // help modal
    'help.title': 'Kailangan ng Tulong?',
    'help.desc': 'Mangyari pong pumunta sa cashier area para matulungan.',
    'help.close': 'Isara',
    // menu
    'menu.loading': 'Nagl-load...',
    'menu.back': 'Bumalik',
    'menu.empty': 'Walang laman ang kategoryang ito',
    'menu.soldout': 'WALA NA',
    'menu.view_order': 'Tingnan ang Order',
    // cart
    'cart.empty': 'Walang laman ang cart mo',
    'cart.browse': 'Tingnan ang Menu',
    'cart.back': 'Bumalik sa Menu',
    'cart.title': 'Ang Iyong Order',
    'cart.items': 'item',
    'cart.items_plural': 'items',
    'cart.total': 'Kabuuan',
    'cart.proceed': 'Magbayad',
    // payment
    'payment.title': 'Pagbabayad',
    'payment.back': 'Bumalik',
    'payment.total': 'Kabuuang Halaga',
    'payment.cash': 'Cash',
    'payment.cash_desc': 'Magbayad sa counter',
    'payment.gcash': 'GCash',
    'payment.gcash_desc': 'I-scan ang QR para magbayad',
    'payment.gcash_info': 'May ipapakitang QR code pagkatapos mo umorder. I-scan gamit ang GCash at ipadala ang sakto. Ikukumpirma ito sa counter.',
    'payment.cash_info': 'Ipo-process ang iyong order at makakakuha ka ng order number. Dalhin ito sa counter at magbayad ng cash.',
    'payment.button': 'Ilagay ang Order',
    'payment.loading': 'Pinoproseso...',
    'payment.error': 'May nangyaring mali. Paki-ulit muli.',
    // gcash flow
    'gcash.cancel': 'Kanselahin',
    'gcash.title': 'Bayad gamit GCash',
    'gcash.expired': 'Natapos na ang Oras',
    'gcash.expired_desc': 'Kinansela na ang iyong order. Mangyaring magsimula ng bago.',
    'gcash.new_order': 'Magsimula Ulit',
    'gcash.send_exactly': 'Ipadala ang eksaktong',
    'gcash.order': 'Order',
    'gcash.setup_admin': 'Nag-aayos ng QR ang admin',
    'gcash.how_to': 'Paano Magbayad:',
    'gcash.step1': 'Buksan ang GCash app',
    'gcash.step2': 'Pindutin ang "Pay QR" at i-scan ito',
    'gcash.step3': 'Ilagay ang eksaktong halaga:',
    'gcash.step4': 'Kumpirmahin at Ipadala',
    'gcash.sent': "Nakapagpadala Na Ako",
    // confirmed
    'confirmed.order_no': 'Numero ng Order',
    'confirmed.cash_title': 'Magbayad sa counter',
    'confirmed.cash_desc': 'Ipakita ang order number sa cashier at magbayad.',
    'confirmed.gcash_title': 'Pinoproseso ang bayad',
    'confirmed.gcash_desc': 'Iko-confirm ng staff ang GCash mo. Abangan ang number mo sa screen.',
    'confirmed.wait': 'Tinatayang oras: 8–12 minuto',
    'confirmed.returning': 'Babalik sa home sa loob ng',
  },
  ceb: {
    // welcome (incorporating user changes)
    'welcome.favorites': 'Paborito nako',
    'welcome.fuel': 'GASOLINAHI',
    'welcome.strength': 'IMONG LAWAS.',
    'welcome.desc': 'Ang pinaka-nindot nga kan-anan sa campus. Bag-ong luto, paspas, ug swak sa budget oh yeh.',
    'welcome.tap': 'PINDOTA KOH',
    'welcome.budget': 'SWAK SA BUDGET',
    'welcome.help': 'Patabang ka chuy?',
    'welcome.help_desc': 'Pindota aron matabangan',
    'welcome.screensaver': 'Pindota bisan asa aron mo-order',
    // help modal
    'help.title': 'Naay Blema?',
    'help.desc': 'Palihug adto sa cashier area para matabangan.',
    'help.close': 'Sirado',
    // menu
    'menu.loading': 'waitsa...',
    'menu.back': 'Balik',
    'menu.empty': 'Wap-ay item sa kini nga kategorya',
    'menu.soldout': 'HUTDAN',
    'menu.view_order': 'Tan-awa ang Order',
    // cart
    'cart.empty': 'Walay sud imung cart',
    'cart.browse': 'Pili ug Pagkaon',
    'cart.back': 'Balik sa Pili-anan',
    'cart.title': 'Imung Order',
    'cart.items': 'item',
    'cart.items_plural': 'items',
    'cart.total': 'Tanan Pabayran',
    'cart.proceed': 'Bayad Na',
    // payment
    'payment.title': 'Ibayad',
    'payment.back': 'Balik',
    'payment.total': 'Tanan Pabayran',
    'payment.cash': 'Cash',
    'payment.cash_desc': 'Bayad sa counter',
    'payment.gcash': 'GCash',
    'payment.gcash_desc': 'I-scan ang QR',
    'payment.gcash_info': 'Magpakita ug QR paghuman og click. I-scan sa GCash para mubayad sa eksakto nga kantidad.',
    'payment.cash_info': 'Ihatag na imung order ug makakuha ka og order number. Dalha sa counter para mubayad.',
    'payment.button': 'Ipadayon',
    'payment.loading': 'Pagpaabot kadali...',
    'payment.error': 'Naay gamay blema. Padayon ra.',
    // gcash flow
    'gcash.cancel': 'Kansela',
    'gcash.title': 'Bayad GCash',
    'gcash.expired': 'Nahuman na ang oras',
    'gcash.expired_desc': 'Gi cancel imung order. Pagsugod ra ug usab.',
    'gcash.new_order': 'Balik og Order',
    'gcash.send_exactly': 'Eksakto ihatag nga',
    'gcash.order': 'Order',
    'gcash.setup_admin': 'Ang admin ray mag taud sa QR',
    'gcash.how_to': 'Unsay buhaton:',
    'gcash.step1': 'Ablihi ang imung GCash app',
    'gcash.step2': 'Click "Pay QR" tapos i-scan kini',
    'gcash.step3': 'Mubutang nga',
    'gcash.step4': 'E-confirm dayon ipadala',
    'gcash.sent': "Nabayran Na",
    // confirmed
    'confirmed.order_no': 'Numero sa imong Order',
    'confirmed.cash_title': 'Bayad sa counter',
    'confirmed.cash_desc': 'Ipakita ang numero sa order didto sa cashier tapos bayari.',
    'confirmed.gcash_title': 'Paghulat para moconfirm',
    'confirmed.gcash_desc': 'Huwata lang i-confirm sa staff ang imung GCash. Atangi sa TV screen.',
    'confirmed.wait': 'Paghulat: 8–12 minutos',
    'confirmed.returning': 'Mobalik sa sugod inig',
  }
}

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')

  const t = (key: string) => {
    return translations[language]?.[key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider')
  return ctx
}
