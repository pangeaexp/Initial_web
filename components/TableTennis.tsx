export function TableTennisPaddle({ opponent = false, className = 'h-[62px] w-12' }: { opponent?: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 82" className={className} style={opponent ? { transform: 'rotate(180deg)' } : undefined}>
      <rect x="27" y="50" width="10" height="29" rx="4" fill="#cfaa75" stroke="#38291d" strokeWidth="2" />
      <ellipse cx="32" cy="30" rx="27" ry="28" fill={opponent ? '#272425' : '#bd0b35'} stroke="#eadbc1" strokeWidth="3" />
      <path d="M15 20c3-8 10-12 18-12" fill="none" stroke="white" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
      <text x="32" y="36" textAnchor="middle" fill="white" fontSize="14" fontWeight="800">TT</text>
    </svg>
  )
}

export function TableTennisBall() {
  return <span aria-hidden="true" data-table-tennis-ball className="pointer-events-none absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 shadow-[0_3px_9px_#0008]" style={{ background: 'radial-gradient(circle at 32% 25%, #fff 0%, #fafafa 48%, #c9d1cf 100%)' }} />
}

export function TableTennisCourt() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      <div className="absolute inset-3 border-2 border-white/80" />
      <div className="absolute bottom-3 left-1/2 top-3 w-px bg-white/65" />
      <div className="absolute inset-x-1 top-1/2 h-3 -translate-y-1/2 border-y border-white/90 shadow-[0_3px_5px_#0006]" style={{ backgroundColor: '#203b35', backgroundImage: 'repeating-linear-gradient(90deg,transparent 0px,transparent 5px,#ffffff80 5px,#ffffff80 6px)' }} />
      <div className="absolute left-6 right-6 top-[24%] text-center text-xs font-black tracking-[.2em] text-white/25 sm:text-sm">CE JOVENTUT TT</div>
    </div>
  )
}
