import { useEffect, useMemo, useState } from 'react';
import { speak } from './lib/tts.js';
import { haptic } from './lib/telegram.js';
import {
  House, BookOpen, ChartColumn, User, Bell, GraduationCap, BookA, BadgeCheck, BriefcaseBusiness, Plane, Heart,
  Target, Folder, Lock, Check, Play, Volume2, VolumeX, Search, CalendarDays, Pencil, Trophy, Settings, ChevronRight,
  ArrowRight, ArrowLeft, X, Flame, Star, Box, Lightbulb, RefreshCw, Flag, Gift, Crown, Gem, Medal, Library, CircleHelp,
  ALargeSmall, ArrowUpRight, AlignLeft, Gauge, Rocket, Pointer, Map as MapIcon, Zap, Clock, Globe, Info, Moon, Trash2,
  GalleryVerticalEnd, Award, ChartNoAxesColumn, BookOpenCheck, Sparkles, Ellipsis, Headphones, PenLine,
} from 'lucide-react';

// ---------- Mascot: 21 static emotions from Valeria + light CSS animation (SPEC §9) ----------
export const EMOTIONS = {
  idle: '01_idle_calm', greeting: '02_greeting_wave', sleeping: '03_sleeping', waking: '04_waking_up',
  explaining: '05_explaining', thinking: '06_thinking', listening: '07_listening', speaking: '08_speaking',
  correct: '09_correct_answer', celebration: '10_celebration', fire: '11_streak_on_fire', mistake: '12_small_mistake',
  encouragement: '13_encouragement', badge: '14_new_badge', levelup: '15_level_up', streak: '16_daily_streak',
  gift: '17_secret_gift', surprised: '18_surprised', sad: '19_streak_lost_sad', thanks: '20_thank_you', searching: '21_searching',
};

// A single-file build may embed the images as data URIs in window.__MASCOT.
function mascotSrc(file) {
  return (typeof window !== 'undefined' && window.__MASCOT?.[file]) || `./assets/mascot/${file}.webp`;
}

// Preload the emotions used mid-lesson so the swap is instant.
if (typeof window !== 'undefined') {
  for (const k of ['correct', 'mistake', 'encouragement', 'fire', 'celebration', 'explaining']) {
    const img = new Image();
    img.src = mascotSrc(EMOTIONS[k]);
  }
}

export function Mascot({ emotion = 'idle', size = 140, anim = 'float', sparkles = false, style, className = '' }) {
  const file = EMOTIONS[emotion] || EMOTIONS.idle;
  return (
    <span className={`mascot-wrap ${className}`} style={{ width: size, ...style }}>
      <img
        key={emotion}
        className={`mascot m-pop ${anim === 'float' ? '' : `m-${anim}`}`}
        src={mascotSrc(file)}
        alt="Verbi"
        width={size}
        style={{ width: size, height: 'auto' }}
        draggable={false}
      />
      {sparkles && (
        <span className="sparkles" aria-hidden>
          <i style={{ left: '4%', top: '10%' }}>✦</i>
          <i style={{ right: '2%', top: '18%', animationDelay: '.4s' }}>✧</i>
          <i style={{ left: '12%', bottom: '10%', animationDelay: '.8s' }}>✧</i>
          <i style={{ right: '10%', bottom: '4%', animationDelay: '1.1s' }}>✦</i>
        </span>
      )}
    </span>
  );
}

export function FloatingMascot(props) {
  return (
    <div className="m-float" style={{ display: 'inline-block' }}>
      <Mascot {...props} anim={props.anim || 'pop'} />
    </div>
  );
}

// ---------- Icons: Lucide line icons, the style of Valeria's mockups ----------

const ICONS = {
  back: ArrowLeft, arrow: ArrowRight, close: X, home: House, book: BookOpen, map: MapIcon, grad: GraduationCap, user: User,
  gear: Settings, sound: Volume2, lock: Lock, check: Check, star: Star, refresh: RefreshCw, flame: Flame, play: Play,
  bolt: Zap, heart: Heart, briefcase: BriefcaseBusiness, plane: Plane, cap: GraduationCap, clock: Clock, flag: Flag,
  gift: Gift, search: Search, globe: Globe, info: Info, moon: Moon, trash: Trash2, cards: GalleryVerticalEnd,
  chevron: ChevronRight, trophy: Trophy, target: Target, gem: Gem, books: Library, medal: Medal, crown: Crown,
  question: CircleHelp, grammar: ALargeSmall, jump: ArrowUpRight, mute: VolumeX, bulb: Lightbulb, text: AlignLeft,
  slow: Gauge, rocket: Rocket, hand: Pointer, bell: Bell, chart: ChartColumn, folder: Folder, missions: BadgeCheck,
  calendar: CalendarDays, pencil: Pencil, box: Box, practice: BookOpenCheck, dict: BookA, results: ChartNoAxesColumn,
  award: Award, sparkles: Sparkles, more: Ellipsis, headphones: Headphones, write: PenLine,
};

export function Icon({ name, size = 22, stroke = 1.8, fill = 'none', style }) {
  const C = ICONS[name] || CircleHelp;
  return <C size={size} strokeWidth={stroke} fill={fill} style={style} aria-hidden />;
}

// Soft rounded tile with a line icon — the icon treatment from Valeria's mockups.
export function Tile({ icon, size = 40, tone = 'primary', style }) {
  return (
    <span className={`tile tile-${tone}`} style={{ width: size, height: size, ...style }}>
      <Icon name={icon} size={Math.round(size * 0.5)} stroke={1.8} />
    </span>
  );
}

export function TopBar({ title, onBack, right }) {
  return (
    <div className="topbar">
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="back"><Icon name="back" /></button>
      )}
      <div className="t">{title}</div>
      {right}
    </div>
  );
}

export function Bar({ value, style }) {
  return <div className="bar" style={style}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function Dots({ n, i }) {
  return <div className="dots">{Array.from({ length: n }, (_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>;
}

export function Speak({ text, audio, enabled = true, lg = false, slow = false, label }) {
  return (
    <button
      className={`speak ${lg ? 'lg' : ''}`}
      aria-label={label || 'play'}
      onClick={(e) => { e.stopPropagation(); haptic('light'); speak(text, { audio, slow, enabled }); }}
    >
      <Icon name="sound" size={lg ? 34 : 18} />
    </button>
  );
}

export function Toggle({ on, onChange }) {
  return <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} />;
}

export function Sheet({ children, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export function Confetti({ n = 40 }) {
  const pieces = useMemo(
    () => Array.from({ length: n }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.8 + Math.random() * 1.4,
      color: ['#f5b94a', '#a48bdc', '#7a62b0', '#f08fb1', '#7fd3a8', '#8ec5ff'][i % 6],
      rot: Math.random() * 360,
    })),
    [n]
  );
  const [show, setShow] = useState(true);
  useEffect(() => { const t = setTimeout(() => setShow(false), 3600); return () => clearTimeout(t); }, []);
  if (!show) return null;
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}

export function Option({ icon, title, sub, selected, onClick, right, letter, state }) {
  return (
    <button className={`option ${selected ? 'sel' : ''} ${state || ''}`} onClick={onClick}>
      {letter && <span className="letter">{letter}</span>}
      {icon && <span className="ico">{typeof icon === 'string' && ICONS[icon] ? <Icon name={icon} /> : icon}</span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="title" style={{ display: 'block' }}>{title}</span>
        {sub && <span className="small" style={{ display: 'block' }}>{sub}</span>}
      </span>
      {right}
      {selected && !right && <span className="check"><Icon name="check" size={14} stroke={3} /></span>}
    </button>
  );
}
