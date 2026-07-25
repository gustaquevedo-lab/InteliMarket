import { motion } from "framer-motion"
import { useLocation } from "react-router-dom"

const variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

interface AnimatedPageProps {
  children: React.ReactNode
  className?: string
}

export function AnimatedPage({ children, className = "" }: AnimatedPageProps) {
  const { pathname } = useLocation()
  return (
    <motion.div
      key={pathname}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
