'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { POLICY_MESSAGE, RETURN_MESSAGE } from '@/lib/after-sales-policy'
export default function StoreReturnPolicy({ storeId }: { storeId: string }) {
 const [store,setStore]=useState<any>(null)
 useEffect(()=>{let active=true;setStore(null);if(storeId)fetch(`/api/database/stores/${encodeURIComponent(storeId)}`).then(r=>r.ok?r.json():null).then(d=>{if(active)setStore(d?.data)}).catch(()=>{});return()=>{active=false}},[storeId])
 return <aside className="mb-4 rounded border p-3 space-y-2 text-sm"><p>{POLICY_MESSAGE}</p><p>{RETURN_MESSAGE}</p>{store?<><p>Change-of-mind returns: {store.acceptReturns?'accepted subject to conditions':'not offered'}. Customer-requested exchanges: {store.acceptExchanges?'accepted subject to conditions':'not offered'}.</p>{store.returnPolicy&&<p>{store.returnPolicy}</p>}</>:<p>Check the store’s voluntary return conditions before ordering.</p>}<p>Store conditions do not remove remedies for wrong or faulty goods.</p><Link className="underline" href="/returns">Returns and replacements</Link></aside>
}
