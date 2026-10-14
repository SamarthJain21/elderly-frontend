import { useOutletContext } from 'react-router'
import type { ElderProfile } from '../../lib/types'

export interface ElderOutlet {
  elder: ElderProfile
  reloadElder: () => void
}

export function useElder(): ElderOutlet {
  return useOutletContext<ElderOutlet>()
}
