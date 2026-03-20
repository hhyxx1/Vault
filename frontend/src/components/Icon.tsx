import React from 'react';
const svgModules = import.meta.glob('../assets/icons/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const iconMap = {
  dashboard: 'dashboard',
  survey: 'survey',
  class: 'class',
  password: 'password',
  user: 'user',
  logout: 'logout',
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  close: 'close',
  book: 'book',
  code: 'code',
  description: 'description',
  calendar: 'calendar',
  award: 'award',
  sparkles: 'sparkles',
  key: 'key',
  add: 'add',
  csv: 'csv',
  edit: 'edit',
  'check-circle': 'check-circle',
  'alert-triangle': 'alert-triangle',
  'bar-chart': 'bar-chart',
  clock: 'clock',
  'file-text': 'file-text',
  info: 'info',
  target: 'target',
  library: 'library',
  robot: 'robot',
  send: 'send',
  attachment: 'attachment',
  refresh: 'refresh',
};

export type IconName = keyof typeof iconMap;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, className = '' }) => {
  const fileName = iconMap[name];
  const moduleKey = `../assets/icons/${fileName}.svg`;
  const rawSvg = svgModules[moduleKey];
  const normalizedClassName = className.replace(/\bbg-([^\s]+)/g, 'text-$1');
  
  if (!rawSvg) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  const svg = rawSvg.replace('<svg', '<svg width="100%" height="100%"');
  
  return (
    <span
      className={`inline-flex items-center justify-center ${normalizedClassName}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
