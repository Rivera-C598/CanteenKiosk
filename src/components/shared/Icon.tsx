interface IconProps {
  name: string
  className?: string
  filled?: boolean
  size?: number
}

export function Icon({ name, className = '', filled = false, size = 24 }: IconProps) {
  const style = {
    fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
    fontSize: `${size}px`,
  }
  return (
    <span className={`material-symbols-outlined ${className}`} style={style}>
      {name}
    </span>
  )
}
