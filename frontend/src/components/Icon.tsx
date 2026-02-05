import React from 'react';

// Import icons
import dashboard from '../assets/icons/dashboard.svg';
import survey from '../assets/icons/survey.svg';
import classIcon from '../assets/icons/class.svg';
import password from '../assets/icons/password.svg';
import user from '../assets/icons/user.svg';
import logout from '../assets/icons/logout.svg';
import chevronLeft from '../assets/icons/chevron-left.svg';
import chevronRight from '../assets/icons/chevron-right.svg';
import close from '../assets/icons/close.svg';
import book from '../assets/icons/book.svg';
import code from '../assets/icons/code.svg';
import description from '../assets/icons/description.svg';
import calendar from '../assets/icons/calendar.svg';
import award from '../assets/icons/award.svg';
import sparkles from '../assets/icons/sparkles.svg';
import key from '../assets/icons/key.svg';
import add from '../assets/icons/add.svg';
import csv from '../assets/icons/csv.svg';
import edit from '../assets/icons/edit.svg';
import checkCircle from '../assets/icons/check-circle.svg';
import alertTriangle from '../assets/icons/alert-triangle.svg';
import barChart from '../assets/icons/bar-chart.svg';
import clock from '../assets/icons/clock.svg';
import fileText from '../assets/icons/file-text.svg';
import info from '../assets/icons/info.svg';
import target from '../assets/icons/target.svg';
import library from '../assets/icons/library.svg';
import robot from '../assets/icons/robot.svg';
import send from '../assets/icons/send.svg';
import attachment from '../assets/icons/attachment.svg';

const iconMap: Record<string, string> = {
  dashboard,
  survey,
  class: classIcon,
  password,
  user,
  logout,
  'chevron-left': chevronLeft,
  'chevron-right': chevronRight,
  close,
  book,
  code,
  description,
  calendar,
  award,
  sparkles,
  key,
  add,
  csv,
  edit,
  'check-circle': checkCircle,
  'alert-triangle': alertTriangle,
  'bar-chart': barChart,
  clock,
  'file-text': fileText,
  info,
  target,
  library,
  robot,
  send,
  attachment,
};

export type IconName = keyof typeof iconMap;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, className = '' }) => {
  const src = iconMap[name];
  
  return (
    <span 
      className={`inline-block ${className}`}
      style={{
        width: size,
        height: size,
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        backgroundColor: 'currentColor'
      }}
    />
  );
};
