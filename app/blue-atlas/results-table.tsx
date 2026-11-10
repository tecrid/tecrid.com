'use client';

import {Fragment, useId, useState} from 'react';
import type {SampleDocument} from './record';

export type ResultRow = SampleDocument['results'][number] & {
  group?: string;
  category?: string;
  family?: string;
  cas?: string;
  methodNote?: string;
};

function family(row: ResultRow) {
  const supplied = row.group || row.category || row.family;
  if (supplied) return supplied;
  if (/perfluoro|polyfluoro|fluorotelomer|^PF[A-Z]|^HFPO|^GenX/i.test(row.analyte)) return 'PFAS';
  if (/phthalate/i.test(row.analyte)) return 'Phthalates';
  if (/microplastic|polyethylene|polypropylene|polystyrene/i.test(row.analyte)) return 'Microplastics';
  if (/^(Pb|Hg|As|Cd|Ni|Al|Cr|Sn)/.test(row.symbol)) return 'Elements';
  return 'Other results';
}

function status(row: ResultRow) {
  // Preserve the laboratory's assessment; do not calculate compliance from numbers.
  if (/above|exceed|out.?of/i.test(row.status)) return {label: 'Above spec', tone: 'above', full: row.status};
  if (row.qualifier === 'less_than' || /^\s*</.test(row.resultText)) return {label: 'Below LOQ', tone: 'below', full: `Below limit of quantification. ${row.status}`};
  if (!row.limitText || /not specified|no spec/i.test(row.limitText + ' ' + row.status)) return {label: 'No spec', tone: 'neutral', full: 'No specification supplied. ' + row.status};
  if (/within/i.test(row.status)) return {label: 'Within spec', tone: 'within', full: row.status};
  return {label: row.status || 'Reported', tone: 'neutral', full: row.status || 'Reported without a laboratory assessment'};
}

export function ResultsTable({rows}: {rows: ResultRow[]}) {
  const id = useId();
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const groups = new Map<string, ResultRow[]>();
  for (const row of rows) {
    const name = family(row);
    const group = groups.get(name) || [];
    group.push(row);
    groups.set(name, group);
  }
  const grouped = groups.size > 1 || rows.length > 12;
  let shown = 0;
  const sections = [...groups].map(([name, items], index) => {
    const open = showAll || rows.length <= 12 || (expanded[name] ?? index === 0);
    const visible = open ? items.slice(0, !showAll && groups.size === 1 ? 20 : items.length) : [];
    shown += visible.length;
    return {name, items, open, visible, index};
  });

  return <div className="atlas-results">
    <table className="atlas-results-table" id={id}>
      <caption className="sr-only">Reported results with original units, quantification limits, specifications and laboratory statuses</caption>
      <thead><tr>{['Analyte', 'Result', 'LOQ', 'Specification', 'Status'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
      {sections.map(({name, items, open, visible, index}) => <Fragment key={name}>
        {grouped && <tbody>
        <tr className="atlas-results-group"><th colSpan={5} scope="rowgroup" id={`${id}-heading-${index}`}>
          {rows.length > 12 ? <button type="button" aria-expanded={open} aria-controls={`${id}-group-${index}`} onClick={() => {
            if (showAll) {
              setShowAll(false);
              setExpanded(Object.fromEntries(sections.map(section => [section.name, section.name === name ? false : section.open])));
            } else setExpanded(previous => ({...previous, [name]: !open}));
          }}><span>{name} <span className="atlas-results-group-count">{items.length}</span></span>{' '}<span>{open ? 'Collapse' : 'Expand'}</span></button> : <span>{name} <span className="atlas-results-group-count">{items.length}</span></span>}
        </th></tr></tbody>}
        <tbody id={`${id}-group-${index}`} aria-labelledby={grouped ? `${id}-heading-${index}` : undefined} hidden={!open}>
        {visible.map((row) => {
          const assessment = status(row);
          const note = row.methodNote || (/Cr[⁶6]/.test(row.symbol) ? 'Separate speciation method' : '');
          const secondary = [row.symbol, row.cas && `CAS ${row.cas}`, note].filter(Boolean).join(' · ');
          return <tr className="atlas-results-row" key={row.sequence}>
            <th scope="row"><span className="atlas-results-name">{row.analyte}</span><small title={row.method}>{secondary || row.method}</small></th>
            <td className="atlas-results-value">{row.resultText} <span>{row.unit}</span></td>
            <td className="atlas-results-loq" data-label="LOQ">{row.loqText || 'Not stated'}</td>
            <td className="atlas-results-spec" data-label="Spec">{row.limitText && !/not specified/i.test(row.limitText) ? row.limitText : 'None supplied'}</td>
            <td className="atlas-results-status"><span className={`atlas-result-tag ${assessment.tone}`} title={assessment.full} aria-label={assessment.full}>{assessment.label}</span></td>
          </tr>;
        })}
      </tbody></Fragment>)}
    </table>
    {rows.length > 20 && <div className="atlas-results-footer"><span aria-live="polite">{shown} of {rows.length} results</span><button type="button" aria-expanded={showAll} aria-controls={id} onClick={() => {setShowAll(previous => !previous); setExpanded({});}}>{showAll ? 'Show fewer results' : `Show all ${rows.length} results`}</button></div>}
  </div>;
}
