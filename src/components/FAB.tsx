import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function FAB() {
  const navigate = useNavigate()
  const [pressed, setPressed] = useState(false)

  return (
    <button
      className="fab"
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={() => navigate('/chats')}
      style={{
        transform: pressed ? 'scale(0.92)' : undefined,
        fontSize: '13px',
        fontWeight: '700',
        letterSpacing: '0.02em'
      }}
      title="Ask AI"
    >
      AI
    </button>
  )
}
