import {afterEach, expect, it} from 'vitest';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {ResultsTable} from '../app/blue-atlas/results-table';
import {sampleCredentialDocument} from '../app/blue-atlas/sample-record';
import {pfasResults} from './fixtures/pfas-results';

afterEach(cleanup);
const sample = sampleCredentialDocument().results;

it('retains original names, inline result units, methods and full laboratory wording', () => {
  const {container} = render(<ResultsTable rows={sample}/>);
  expect(screen.getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Analyte', 'Result', 'LOQ', 'Specification', 'Status']);
  const chromium = screen.getByRole('rowheader', {name: /Chromium\(VI\)/}).closest('tr')!;
  expect(within(chromium).getByText('< 10')).toBeTruthy();
  expect(chromium.querySelector('.atlas-results-value')?.textContent).toBe('< 10 µg/kg');
  expect(within(chromium).getByText('Cr⁶⁺ · Separate speciation method').title).toContain('DEMO-NLA-CR6-01');
  expect(within(chromium).getByLabelText('Below limit of quantification. Below reporting limit').textContent).toBe('Below LOQ');
  expect(screen.getAllByTitle('Within fictional specification')).toHaveLength(6);
  expect(screen.getByText('No spec')).toBeTruthy();
  expect(container.querySelectorAll('.atlas-results-row')).toHaveLength(8);
  expect(container.querySelector('.element-symbol')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
});

it('honors above-spec assessments and does not invent a within-spec assessment', () => {
  render(<ResultsTable rows={[{...sample[0], status: 'Above fictional specification'}, {...sample[1], status: 'Pending review'}]}/>);
  expect(screen.getByTitle('Above fictional specification').textContent).toBe('Above spec');
  expect(screen.getByTitle('Pending review').textContent).toBe('Pending review');
});

it('groups the forty-compound fixture, expands individual groups, and shows all results', () => {
  const {container} = render(<ResultsTable rows={pfasResults}/>);
  expect(pfasResults).toHaveLength(40);
  expect(container.querySelectorAll('.atlas-results-row')).toHaveLength(10);
  const sulfonic = screen.getByRole('button', {name: /Sulfonic acids 10 Expand/});
  expect(sulfonic.getAttribute('aria-expanded')).toBe('false');
  expect(document.getElementById(sulfonic.getAttribute('aria-controls')!)).toBeTruthy();
  fireEvent.click(sulfonic);
  expect(container.querySelectorAll('.atlas-results-row')).toHaveLength(20);
  fireEvent.click(screen.getByRole('button', {name: 'Show all 40 results'}));
  expect(container.querySelectorAll('.atlas-results-row')).toHaveLength(40);
  expect(screen.getByText('40 of 40 results')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name: 'Show fewer results'}));
  expect(container.querySelectorAll('.atlas-results-row')).toHaveLength(10);
});

it('caps a single large group at twenty and infers families without category metadata', () => {
  const {container} = render(<ResultsTable rows={pfasResults.map(row => ({...row, group: undefined, family: 'PFAS'}))}/>);
  expect(container.querySelectorAll('.atlas-results-row')).toHaveLength(20);
  fireEvent.click(screen.getByRole('button', {name: 'Show all 40 results'}));
  expect(container.querySelectorAll('.atlas-results-row')).toHaveLength(40);
  cleanup();
  render(<ResultsTable rows={[sample[0], {...sample[1], symbol: 'PFOA', analyte: 'Perfluorooctanoic acid'}]}/>);
  expect(screen.getByText('Elements')).toBeTruthy();
  expect(screen.getByText('PFAS')).toBeTruthy();
});

it('keeps twelve rows open, collapses later categories at thirteen, and expands them independently', () => {
  const rows = pfasResults.slice(0, 13).map((row, index) => ({...row, group: undefined, category: index < 6 ? 'First category' : 'Second category'}));
  const {container, rerender} = render(<ResultsTable rows={rows.slice(0, 12)}/>);
  expect(container.querySelectorAll('.atlas-results-row')).toHaveLength(12);
  expect(screen.queryByRole('button')).toBeNull();
  rerender(<ResultsTable rows={rows}/>);
  expect(container.querySelectorAll('.atlas-results-row')).toHaveLength(6);
  fireEvent.click(screen.getByRole('button', {name: 'Second category 7 Expand'}));
  expect(container.querySelectorAll('.atlas-results-row')).toHaveLength(13);
  fireEvent.click(screen.getByRole('button', {name: 'First category 6 Collapse'}));
  expect(container.querySelectorAll('.atlas-results-row')).toHaveLength(7);
  expect(screen.queryByRole('button', {name:/Show all/})).toBeNull();
});

it('lets individual groups expand beyond twenty without empty expanded sections', () => {
  const {container} = render(<ResultsTable rows={pfasResults}/>);
  fireEvent.click(screen.getByRole('button', {name:'Sulfonic acids 10 Expand'}));
  fireEvent.click(screen.getByRole('button', {name:'Precursors 10 Expand'}));
  expect(container.querySelectorAll('.atlas-results-row')).toHaveLength(30);
  expect(screen.getByText('30 of 40 results')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name:'Show all 40 results'}));
  fireEvent.click(screen.getByRole('button', {name:'Ether acids 10 Collapse'}));
  expect(container.querySelectorAll('.atlas-results-row')).toHaveLength(30);
});
