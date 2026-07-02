import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN.js'
import enUS from './locales/en-US.js'

const STORAGE_KEY = 'scm-locale'
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US']

// 默认跟随系统：无保存偏好时，系统语言 zh* -> 中文，否则英文
function detectLocale() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && SUPPORTED_LOCALES.includes(saved)) {
    return saved
  }
  const sys = (navigator.language || '').toLowerCase()
  return sys.startsWith('zh') ? 'zh-CN' : 'en-US'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectLocale(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  }
})

export function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    return
  }
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.lang = locale
}

// 主进程失败结果（{ code, params, message }）-> 当前语言文案。
// code 未在语言包登记时回退 message 原文，保证未知错误也有内容可显示
export function translateError(err, fallback = '') {
  if (!err) {
    return fallback
  }
  if (typeof err === 'string') {
    return err
  }
  const key = err.code ? `errors.${err.code}` : null
  if (key && i18n.global.te(key)) {
    return i18n.global.t(key, err.params || {})
  }
  return err.message || err.fallback || fallback || i18n.global.t('errors.unknown')
}

// 启动时同步 <html lang>
document.documentElement.lang = i18n.global.locale.value
