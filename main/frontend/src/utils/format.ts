/**
 * 格式化日期时间
 */
export const formatDateTime = (date: string | Date): string => {
  const d = new Date(date)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 格式化相对时间
 */
export const formatRelativeTime = (date: string | Date): string => {
  const now = new Date()
  const past = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return '刚刚'
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}分钟前`
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}小时前`
  } else {
    return `${Math.floor(diffInSeconds / 86400)}天前`
  }
}

/**
 * 计算百分比
 */
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}
