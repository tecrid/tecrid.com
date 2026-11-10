// Browser-only QA fixture. Never imported by production routes.
import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ResultsTable} from '../../app/blue-atlas/results-table';
import {sampleCredentialDocument} from '../../app/blue-atlas/sample-record';
import {pfasResults} from './pfas-results';
import '../../app/globals.css';
import '../../app/mobile.css';
import '../../app/simple.css';
import '../../app/blue-atlas/continuity.css';
import '../../app/blue-atlas/atlas.css';
import '../../app/blue-atlas/public.css';
import '../../app/blue-atlas/workspace.css';
import '../../app/blue-atlas/results.css';

function LayoutFixture() {
  const [panel, setPanel] = useState(new URLSearchParams(location.search).get('panel') === 'pfas' ? 'pfas' : 'sample');
  const [report, setReport] = useState('Measuring layout');
  useEffect(() => {
    function measure() {
      const table = document.querySelector('.atlas-results')!;
      const bounds = table.getBoundingClientRect();
      const rows = [...document.querySelectorAll('.atlas-results-row')];
      const overflow = document.documentElement.scrollWidth > innerWidth || rows.some(row => [...row.children].some(cell => {
        const rect = cell.getBoundingClientRect();
        return rect.left < bounds.left || rect.right > bounds.right || cell.scrollWidth > cell.clientWidth + 1;
      }));
      const heights = rows.map(row => Math.round(row.getBoundingClientRect().height));
      setReport(`${overflow ? 'FAIL: overflow' : 'PASS: no overflow'} | ${innerWidth}px | ${rows.length} rows | heights ${Math.min(...heights)} to ${Math.max(...heights)}px`);
    }
    const observer = new MutationObserver(measure);
    observer.observe(document.querySelector('.atlas-results')!, {childList:true, subtree:true});
    window.addEventListener('resize', measure);
    measure();
    if (new URLSearchParams(location.search).has('all')) {
      const button = [...document.querySelectorAll<HTMLButtonElement>('.atlas-results button')].find(button => button.textContent === 'Show all 40 results');
      button?.click();
    }
    return () => {observer.disconnect(); window.removeEventListener('resize', measure);};
  }, [panel]);
  return <main className="atlas" style={{minHeight:'100vh',paddingBlock:24}}><div className="atlas-container">
    <h1 style={{fontSize:24}}>Results layout verification</h1>
    <p style={{fontSize:12,marginBlock:12}}>Synthetic fixtures only. Resize to 1440, 1280 and 375 pixels.</p>
    <div style={{display:'flex',gap:16,marginBottom:16}}><button onClick={() => setPanel('sample')}>Sample panel</button><button onClick={() => setPanel('pfas')}>40-compound PFAS panel</button></div>
    <output style={{display:'block',fontSize:12,marginBottom:16}}>{report}</output>
    <ResultsTable key={panel} rows={panel === 'sample' ? sampleCredentialDocument().results : pfasResults}/>
  </div></main>;
}
createRoot(document.getElementById('root')!).render(<LayoutFixture/>);
