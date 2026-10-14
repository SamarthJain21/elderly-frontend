import { useOutletContext } from 'react-router'
import type { ElderSummary } from '../../lib/types'

export interface CaretakerOutlet {
  elders: ElderSummary[]
  reloadElders: () => void
}

export function useCaretaker(): CaretakerOutlet {
  return useOutletContext<CaretakerOutlet>()
}
