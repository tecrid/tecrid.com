import {sampleCredentialDocument} from '../../app/blue-atlas/sample-record';
import type {ResultRow} from '../../app/blue-atlas/results-table';

// Synthetic layout fixture only. Values and specifications are invented.
const compounds = [
  ['Carboxylic acids', 'Perfluorobutanoic acid', 'Perfluoropentanoic acid', 'Perfluorohexanoic acid', 'Perfluoroheptanoic acid', 'Perfluorooctanoic acid', 'Perfluorononanoic acid', 'Perfluorodecanoic acid', 'Perfluoroundecanoic acid', 'Perfluorododecanoic acid', 'Perfluorotridecanoic acid'],
  ['Sulfonic acids', 'Perfluorobutanesulfonic acid', 'Perfluoropentanesulfonic acid', 'Perfluorohexanesulfonic acid', 'Perfluoroheptanesulfonic acid', 'Perfluorooctanesulfonic acid', 'Perfluorononanesulfonic acid', 'Perfluorodecanesulfonic acid', 'Perfluoroundecanesulfonic acid', 'Perfluorododecanesulfonic acid', 'Perfluorotridecanesulfonic acid'],
  ['Precursors', '4:2 Fluorotelomer sulfonate', '6:2 Fluorotelomer sulfonate', '8:2 Fluorotelomer sulfonate', '10:2 Fluorotelomer sulfonate', 'Perfluorooctane sulfonamide', 'N-Methyl perfluorooctane sulfonamide', 'N-Ethyl perfluorooctane sulfonamide', 'N-Methyl perfluorooctane sulfonamidoacetic acid', 'N-Ethyl perfluorooctane sulfonamidoacetic acid', 'Perfluorooctane sulfonamidoethanol'],
  ['Ether acids', 'Hexafluoropropylene oxide dimer acid', 'Perfluoro(2-methoxyacetic) acid', 'Perfluoro(3-methoxypropanoic) acid', 'Perfluoro(4-methoxybutanoic) acid', 'Perfluoro-2-ethoxyethanesulfonic acid', 'Perfluoro-3,6-dioxaheptanoic acid', 'Perfluoro-3,6,9-trioxadecanoic acid', '9-Chlorohexadecafluoro-3-oxanonane-1-sulfonic acid', '11-Chloroeicosafluoro-3-oxaundecane-1-sulfonic acid', '4,8-Dioxa-3H-perfluorononanoic acid'],
];
export const pfasResults: ResultRow[] = compounds.flatMap(([group, ...names]) => names.map(analyte => ({
  ...sampleCredentialDocument().results[0], analyte, group, symbol: 'PFAS', unit: 'ng/kg', resultText: '< 10', qualifier: 'less_than' as const, numericValue: null, loqText: '10 ng/kg', limitText: '20 ng/kg', status: 'Below reporting limit', method: 'DEMO-PFAS-01',
}))).map((row, sequence) => ({...row, sequence}));
