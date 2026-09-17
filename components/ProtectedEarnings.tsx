'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
export default function ProtectedEarnings({ onAvailable }: { onAvailable?: (amount: number) => void }) {
 const [balance,setBalance]=useState<any>(null),[error,setError]=useState('')
 useEffect(()=>{let active=true;fetch('/api/after-sales/balance',{credentials:'include'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active){setBalance(d);onAvailable?.(d.available)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[])
 return <aside className="rounded border p-3 text-sm space-y-2">{balance?<p>In escrow: ₦{balance.inEscrow.toLocaleString()} · Pending clearance: ₦{balance.pending.toLocaleString()} · On hold: ₦{balance.onHold.toLocaleString()}</p>:<p>{error||'Refreshing protected earnings…'}</p>}<p>Pending funds are excluded from your withdrawable wallet.</p><Link className="underline" href="/vendor/returns">View returns, replacements and clearance times</Link></aside>
}
