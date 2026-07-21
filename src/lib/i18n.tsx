import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

// Core UI translations for supported Indian languages.
const dictionaries: Record<LangCode, Record<string, string>> = {
  en: {
    dashboard: "Dashboard", profile: "Worker Profile", gigscore: "GigScore",
    income: "Income Analytics", schemes: "Government Schemes", loan: "Loan Eligibility",
    charging: "Nearby Services", location: "Live Location", documents: "Documents",
    sos: "Emergency SOS", settings: "Settings", admin: "Admin",
    welcome_back: "Welcome back", sign_out: "Sign out", search: "Search",
    add_income: "Add income", this_week: "This week", this_month: "This month",
    this_year: "This year", learn_more: "Learn more", approve: "Approve",
    reject: "Reject", pending: "Pending", verified: "Verified",
    share_location: "Share location", save: "Save", cancel: "Cancel",
    language: "Language",
  },
  hi: {
    dashboard: "डैशबोर्ड", profile: "कार्यकर्ता प्रोफ़ाइल", gigscore: "गिगस्कोर",
    income: "आय विश्लेषण", schemes: "सरकारी योजनाएँ", loan: "ऋण पात्रता",
    charging: "नज़दीकी सेवाएँ", location: "लाइव स्थान", documents: "दस्तावेज़",
    sos: "आपातकालीन SOS", settings: "सेटिंग्स", admin: "व्यवस्थापक",
    welcome_back: "वापस स्वागत है", sign_out: "साइन आउट", search: "खोजें",
    add_income: "आय जोड़ें", this_week: "इस सप्ताह", this_month: "इस महीने",
    this_year: "इस वर्ष", learn_more: "और जानें", approve: "स्वीकृत करें",
    reject: "अस्वीकार करें", pending: "लंबित", verified: "सत्यापित",
    share_location: "स्थान साझा करें", save: "सहेजें", cancel: "रद्द करें",
    language: "भाषा",
  },
  kn: {
    dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", profile: "ಕಾರ್ಮಿಕ ಪ್ರೊಫೈಲ್", gigscore: "ಗಿಗ್‌ಸ್ಕೋರ್",
    income: "ಆದಾಯ ವಿಶ್ಲೇಷಣೆ", schemes: "ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು", loan: "ಸಾಲದ ಅರ್ಹತೆ",
    charging: "ಸಮೀಪದ ಸೇವೆಗಳು", location: "ಲೈವ್ ಸ್ಥಳ", documents: "ದಾಖಲೆಗಳು",
    sos: "ತುರ್ತು SOS", settings: "ಸೆಟ್ಟಿಂಗ್‌ಗಳು", admin: "ನಿರ್ವಾಹಕ",
    welcome_back: "ಮತ್ತೆ ಸ್ವಾಗತ", sign_out: "ಸೈನ್ ಔಟ್", search: "ಹುಡುಕಿ",
    add_income: "ಆದಾಯ ಸೇರಿಸಿ", this_week: "ಈ ವಾರ", this_month: "ಈ ತಿಂಗಳು",
    this_year: "ಈ ವರ್ಷ", learn_more: "ಇನ್ನಷ್ಟು", approve: "ಅನುಮೋದಿಸಿ",
    reject: "ತಿರಸ್ಕರಿಸಿ", pending: "ಬಾಕಿ", verified: "ಪರಿಶೀಲಿಸಲಾಗಿದೆ",
    share_location: "ಸ್ಥಳ ಹಂಚಿಕೊಳ್ಳಿ", save: "ಉಳಿಸಿ", cancel: "ರದ್ದುಮಾಡಿ",
    language: "ಭಾಷೆ",
  },
  te: {
    dashboard: "డాష్‌బోర్డ్", profile: "కార్మిక ప్రొఫైల్", gigscore: "గిగ్‌స్కోర్",
    income: "ఆదాయ విశ్లేషణ", schemes: "ప్రభుత్వ పథకాలు", loan: "రుణ అర్హత",
    charging: "సమీప సేవలు", location: "లైవ్ లొకేషన్", documents: "పత్రాలు",
    sos: "అత్యవసర SOS", settings: "సెట్టింగ్‌లు", admin: "నిర్వాహకుడు",
    welcome_back: "మళ్లీ స్వాగతం", sign_out: "సైన్ అవుట్", search: "వెతకండి",
    add_income: "ఆదాయం జోడించండి", this_week: "ఈ వారం", this_month: "ఈ నెల",
    this_year: "ఈ సంవత్సరం", learn_more: "మరింత తెలుసుకోండి", approve: "ఆమోదించండి",
    reject: "తిరస్కరించండి", pending: "పెండింగ్", verified: "ధృవీకరించబడింది",
    share_location: "లొకేషన్ షేర్ చేయండి", save: "సేవ్", cancel: "రద్దు",
    language: "భాష",
  },
  ta: {
    dashboard: "டாஷ்போர்டு", profile: "தொழிலாளர் சுயவிவரம்", gigscore: "கிக்ஸ்கோர்",
    income: "வருமான பகுப்பாய்வு", schemes: "அரசு திட்டங்கள்", loan: "கடன் தகுதி",
    charging: "அருகிலுள்ள சேவைகள்", location: "நேரடி இடம்", documents: "ஆவணங்கள்",
    sos: "அவசர SOS", settings: "அமைப்புகள்", admin: "நிர்வாகி",
    welcome_back: "மீண்டும் வரவேற்கிறோம்", sign_out: "வெளியேறு", search: "தேடு",
    add_income: "வருமானம் சேர்க்க", this_week: "இந்த வாரம்", this_month: "இந்த மாதம்",
    this_year: "இந்த ஆண்டு", learn_more: "மேலும் அறிய", approve: "ஒப்புதல்",
    reject: "நிராகரி", pending: "நிலுவையில்", verified: "சரிபார்க்கப்பட்டது",
    share_location: "இடத்தை பகிர்", save: "சேமி", cancel: "ரத்து",
    language: "மொழி",
  },
  ml: {
    dashboard: "ഡാഷ്‌ബോർഡ്", profile: "തൊഴിലാളി പ്രൊഫൈൽ", gigscore: "ഗിഗ്‌സ്കോർ",
    income: "വരുമാന വിശകലനം", schemes: "സർക്കാർ പദ്ധതികൾ", loan: "വായ്പാ യോഗ്യത",
    charging: "സമീപ സേവനങ്ങൾ", location: "ലൈവ് ലൊക്കേഷൻ", documents: "രേഖകൾ",
    sos: "അടിയന്തര SOS", settings: "ക്രമീകരണങ്ങൾ", admin: "അഡ്മിൻ",
    welcome_back: "വീണ്ടും സ്വാഗതം", sign_out: "സൈൻ ഔട്ട്", search: "തിരയുക",
    add_income: "വരുമാനം ചേർക്കുക", this_week: "ഈ ആഴ്ച", this_month: "ഈ മാസം",
    this_year: "ഈ വർഷം", learn_more: "കൂടുതൽ അറിയുക", approve: "അംഗീകരിക്കുക",
    reject: "നിരസിക്കുക", pending: "തീർപ്പാകാത്ത", verified: "സ്ഥിരീകരിച്ചു",
    share_location: "ലൊക്കേഷൻ പങ്കിടുക", save: "സേവ്", cancel: "റദ്ദാക്കുക",
    language: "ഭാഷ",
  },
  mr: {
    dashboard: "डॅशबोर्ड", profile: "कामगार प्रोफाइल", gigscore: "गिगस्कोर",
    income: "उत्पन्न विश्लेषण", schemes: "सरकारी योजना", loan: "कर्ज पात्रता",
    charging: "जवळील सेवा", location: "थेट स्थान", documents: "कागदपत्रे",
    sos: "आपत्कालीन SOS", settings: "सेटिंग्ज", admin: "प्रशासक",
    welcome_back: "पुन्हा स्वागत आहे", sign_out: "साइन आउट", search: "शोधा",
    add_income: "उत्पन्न जोडा", this_week: "या आठवड्यात", this_month: "या महिन्यात",
    this_year: "या वर्षी", learn_more: "अधिक जाणून घ्या", approve: "मंजूर करा",
    reject: "नाकारा", pending: "प्रलंबित", verified: "सत्यापित",
    share_location: "स्थान सामायिक करा", save: "जतन करा", cancel: "रद्द करा",
    language: "भाषा",
  },
  bn: {
    dashboard: "ড্যাশবোর্ড", profile: "কর্মী প্রোফাইল", gigscore: "গিগস্কোর",
    income: "আয় বিশ্লেষণ", schemes: "সরকারি প্রকল্প", loan: "ঋণ যোগ্যতা",
    charging: "কাছাকাছি পরিষেবা", location: "লাইভ অবস্থান", documents: "নথি",
    sos: "জরুরি SOS", settings: "সেটিংস", admin: "প্রশাসক",
    welcome_back: "আবার স্বাগতম", sign_out: "সাইন আউট", search: "অনুসন্ধান",
    add_income: "আয় যোগ করুন", this_week: "এই সপ্তাহে", this_month: "এই মাসে",
    this_year: "এই বছর", learn_more: "আরও জানুন", approve: "অনুমোদন",
    reject: "প্রত্যাখ্যান", pending: "মুলতুবি", verified: "যাচাইকৃত",
    share_location: "অবস্থান ভাগ করুন", save: "সংরক্ষণ", cancel: "বাতিল",
    language: "ভাষা",
  },
};

type Ctx = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: string, fallback?: string) => string;
  hasTranslations: (l: LangCode) => boolean;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("ss_lang") : null;
    if (stored && LANGUAGES.some((l) => l.code === stored)) setLangState(stored as LangCode);
  }, []);

  const setLang = (l: LangCode) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("ss_lang", l);
    // Fire-and-forget DB persistence when user is signed in.
    import("@/lib/api.functions").then(({ updateMySettings }) => {
      updateMySettings({ data: { language: l } }).catch(() => {});
    }).catch(() => {});
  };

  const t = (key: string, fallback?: string) => {
    const dict = dictionaries[lang] ?? {};
    return dict[key] ?? dictionaries.en[key] ?? fallback ?? key;
  };

  const hasTranslations = (l: LangCode) => Object.keys(dictionaries[l] ?? {}).length > 0;

  return (
    <I18nContext.Provider value={{ lang, setLang, t, hasTranslations }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}