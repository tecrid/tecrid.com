// Reused from PR0b HTTP fixture; no real laboratory report.
export function syntheticPdf(mark="SYNTHETIC scope only"){
 const safe=mark.replace(/[^\x20-\x7e]/g,'-').replace(/[()\\]/g,'');
 const lines=['SYNTHETIC COA - NOT A REAL LABORATORY REPORT','Northstar Analytical - rehearsal fixture only',safe,'Synthetic result: 1 synthetic-unit; no analytical claim.'];
 const stream='BT /F1 10 Tf 20 170 Td '+lines.map((line,i)=>(i?'0 -22 Td ':'')+'('+line+') Tj').join(' ')+' ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 240] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}const xref=Buffer.byteLength(pdf);
 return pdf+'xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
}
