let uploadedFiles = [];
let extractedData = [];

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const uploadBtn = document.getElementById('uploadBtn');
const loading = document.getElementById('loading');
const resultsSection = document.getElementById('resultsSection');
const results = document.getElementById('results');
const errorMsg = document.getElementById('errorMsg');
const successMsg = document.getElementById('successMsg');

// Load persisted data on page load
window.addEventListener('DOMContentLoaded', () => {
    loadPersistedData();
});

// Save data to localStorage whenever it changes
function saveToLocalStorage() {
    try {
        if (extractedData.length > 0) {
            localStorage.setItem('extractedData', JSON.stringify(extractedData));
        }
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

// Load persisted data from localStorage
function loadPersistedData() {
    try {
        const savedData = localStorage.getItem('extractedData');
        if (savedData) {
            extractedData = JSON.parse(savedData);
            if (extractedData.length > 0) {
                displayResults(extractedData);
                showSuccess(`Restored ${extractedData.length} previously processed file(s)`);
            }
        }
    } catch (e) {
        console.error('Error loading from localStorage:', e);
    }
}

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    for (let file of files) {
        if (file.type === 'application/pdf') {
            const isDuplicate = uploadedFiles.some(f => f.name === file.name);
            if (!isDuplicate) {
                uploadedFiles.push(file);
            } else {
                showError(`File "${file.name}" is already in the upload queue`);
            }
        }
    }
    displayFileList();
}

function displayFileList() {
    fileList.innerHTML = '';
    uploadedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <span>📝 ${file.name}</span>
            <span class="remove-file" onclick="removeFile(${index})">✕</span>
        `;
        fileList.appendChild(item);
    });
}

function removeFile(index) {
    uploadedFiles.splice(index, 1);
    displayFileList();
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.add('show');
    setTimeout(() => errorMsg.classList.remove('show'), 5000);
}

function showSuccess(msg) {
    successMsg.textContent = msg;
    successMsg.classList.add('show');
    setTimeout(() => successMsg.classList.remove('show'), 5000);
}

async function uploadFiles() {
    if (uploadedFiles.length === 0) {
        showError('Please select at least one PDF file');
        return;
    }
    
    const formData = new FormData();
    uploadedFiles.forEach(file => {
        formData.append('files', file);
    });
    
    loading.style.display = 'block';
    resultsSection.classList.remove('show');
    
    try {
        const response = await fetch('/api/extract-multiple', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!data.success) {
            showError(data.error || 'Error processing files');
            loading.style.display = 'none';
            return;
        }
        
        const newData = data.data;
        
        newData.forEach(newItem => {
            const existingIndex = extractedData.findIndex(
                item => item.File === newItem.File
            );
            
            if (existingIndex !== -1) {
                extractedData[existingIndex] = newItem;
            } else {
                extractedData.push(newItem);
            }
        });
        
        saveToLocalStorage();
        displayResults(extractedData);
        
        uploadedFiles = [];
        fileList.innerHTML = '';
        fileInput.value = '';
        
        showSuccess(`✓ Successfully processed ${data.count} file(s). Total: ${extractedData.length} file(s)`);
        
    } catch (error) {
        showError('Error uploading files: ' + error.message);
    } finally {
        loading.style.display = 'none';
    }
}

// Generate PDF
function downloadPDF(item, index) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const bank = item['Bank'] || 'UNKNOWN';
    const fileName = item.File || `Statement_${index + 1}`;
    
    // Bank-specific colors
    const bankColors = {
        'SBI': { primary: [25, 118, 210], secondary: [13, 71, 161] },      // Blue
        'HDFC': { primary: [211, 47, 47], secondary: [183, 28, 28] },      // Red
        'ICICI': { primary: [245, 124, 0], secondary: [230, 81, 0] },      // Orange
        'AXIS': { primary: [123, 31, 162], secondary: [74, 20, 140] },     // Purple
        'KOTAK': { primary: [198, 40, 40], secondary: [148, 0, 0] },       // Dark Red
        'UNKNOWN': { primary: [117, 117, 117], secondary: [66, 66, 66] }   // Gray
    };
    
    const colors = bankColors[bank] || bankColors['UNKNOWN'];
    const primaryColor = colors.primary;
    const secondaryColor = colors.secondary;
    const lightGray = [245, 245, 245];
    const darkGray = [100, 100, 100];
    
    // Header background
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 45, 'F');
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold'); 
    doc.text(bank + ' CREDIT CARD', 105, 20, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setFont(undefined, 'normal');
    doc.text('Statement Summary', 105, 32, { align: 'center' });
    
    // File info section
    doc.setFillColor(...lightGray);
    doc.rect(15, 50, 180, 12, 'F');
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Document:', 20, 57);
    doc.setFont(undefined, 'normal');
    doc.text(fileName, 45, 57);
    
    // Main content box with border
    doc.setDrawColor(...secondaryColor);
    doc.setLineWidth(0.5);
    doc.rect(15, 70, 180, 120, 'S');
    
    // Section title
    doc.setFillColor(...primaryColor);
    doc.rect(15, 70, 180, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('ACCOUNT DETAILS', 105, 77, { align: 'center' });
    
    // Data rows
    let yPos = 90;
    const leftMargin = 25;
    const valueMargin = 110;
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    
    // Row 1: Available Credit Limit
    doc.setFillColor(250, 250, 250);
    doc.rect(16, yPos - 5, 170, 12, 'F');
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Available Credit Limit', leftMargin, yPos);
    doc.setFont(undefined, 'normal');
    doc.text('Rs. ' + (item['Available Credit Limit'] || 'N/A'), valueMargin, yPos);
    
    yPos += 15;
    
    // Row 2: Available Cash Limit
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text('Available Cash Limit', leftMargin, yPos);
    doc.setFont(undefined, 'normal');
    doc.text('Rs. ' + (item['Available Cash Limit'] || 'N/A'), valueMargin, yPos);
    
    yPos += 15;
    
    // Row 3: Payment Due Date
    doc.setFillColor(250, 250, 250);
    doc.rect(16, yPos - 5, 170, 12, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text('Payment Due Date', leftMargin, yPos);
    doc.setFont(undefined, 'normal');
    doc.text(item['Payment Due Date'] || 'N/A', valueMargin, yPos);
    
    yPos += 15;
    
    // Row 4: Total Outstanding
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text('Total Outstanding', leftMargin, yPos);
    doc.setFont(undefined, 'normal');
    doc.text('Rs. ' + (item['Total Outstanding'] || 'N/A'), valueMargin, yPos);
    
    yPos += 15;
    
    // Row 5: Reward Points / Minimum Amount Due (bank-specific)
    const lastFieldLabel = bank === 'HDFC' ? 'Minimum Amount Due' : 'Reward Points Earned';
    doc.setFillColor(250, 250, 250);
    doc.rect(16, yPos - 5, 170, 12, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(lastFieldLabel, leftMargin, yPos);
    doc.setFont(undefined, 'normal');
    const lastFieldValue = bank === 'HDFC' ? 'Rs. ' + (item['Reward Points Earned'] || 'N/A') : (item['Reward Points Earned'] || 'N/A');
    doc.text(lastFieldValue, valueMargin, yPos);
    
    // Important Notice Box
    yPos = 200;
    doc.setFillColor(255, 243, 205); // Light yellow
    doc.rect(15, yPos, 180, 25, 'F');
    doc.setDrawColor(255, 193, 7);
    doc.setLineWidth(0.5);
    doc.rect(15, yPos, 180, 25, 'S');
    
    doc.setTextColor(133, 100, 4);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('IMPORTANT:', 20, yPos + 7);
    doc.setFont(undefined, 'normal');
    doc.text('Please ensure timely payment to avoid late fees and maintain good credit score.', 20, yPos + 14);
    doc.text(`For queries, contact ${bank} Credit Card customer care.`, 20, yPos + 20);
    
    // Footer
    doc.setFillColor(...darkGray);
    doc.rect(0, 270, 210, 27, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('This is a computer-generated document. No signature required.', 105, 280, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 105, 286, { align: 'center' });
    doc.setFontSize(7);
    doc.text('© 2025 Credit Statement Parser - All Rights Reserved', 105, 291, { align: 'center' });
    
    // Save the PDF
    const pdfFileName = fileName.replace('.pdf', '') + '_statement.pdf';
    doc.save(pdfFileName);
    
    showSuccess(`✓ PDF downloaded: ${pdfFileName}`);
}

// Generate combined professional PDF for all results
function downloadAllPDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const lightGray = [245, 245, 245];
    const darkGray = [100, 100, 100];
    
    data.forEach((item, index) => {
        if (index > 0) {
            doc.addPage();
        }
        
        const bank = item['Bank'] || 'UNKNOWN';
        const fileName = item.File || `Statement_${index + 1}`;
        
        // Bank-specific colors
        const bankColors = {
            'SBI': { primary: [25, 118, 210], secondary: [13, 71, 161] },
            'HDFC': { primary: [211, 47, 47], secondary: [183, 28, 28] },
            'ICICI': { primary: [245, 124, 0], secondary: [230, 81, 0] },
            'AXIS': { primary: [123, 31, 162], secondary: [74, 20, 140] },
            'KOTAK': { primary: [198, 40, 40], secondary: [148, 0, 0] },
            'UNKNOWN': { primary: [117, 117, 117], secondary: [66, 66, 66] }
        };
        
        const colors = bankColors[bank] || bankColors['UNKNOWN'];
        const primaryColor = colors.primary;
        const secondaryColor = colors.secondary;
        
        // Header background
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 45, 'F');
        
        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text(bank + ' CREDIT CARD', 105, 20, { align: 'center' });
        
        doc.setFontSize(16);
        doc.setFont(undefined, 'normal');
        doc.text('Statement Summary', 105, 32, { align: 'center' });
        
        // Page number
        doc.setFontSize(10);
        doc.text(`Page ${index + 1} of ${data.length}`, 105, 39, { align: 'center' });
        
        // File info section
        doc.setFillColor(...lightGray);
        doc.rect(15, 50, 180, 12, 'F');
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Document:', 20, 57);
        doc.setFont(undefined, 'normal');
        doc.text(fileName, 45, 57);
        
        // Main content box
        doc.setDrawColor(...secondaryColor);
        doc.setLineWidth(0.5);
        doc.rect(15, 70, 180, 120, 'S');
        
        // Section title
        doc.setFillColor(...primaryColor);
        doc.rect(15, 70, 180, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('ACCOUNT DETAILS', 105, 77, { align: 'center' });
        
        // Data rows
        let yPos = 90;
        const leftMargin = 25;
        const valueMargin = 110;
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        
        // Available Credit Limit
        doc.setFillColor(250, 250, 250);
        doc.rect(16, yPos - 5, 170, 12, 'F');
        doc.setFont(undefined, 'bold');
        doc.text('Available Credit Limit', leftMargin, yPos);
        doc.setFont(undefined, 'normal');
        doc.text('Rs. ' + (item['Available Credit Limit'] || 'N/A'), valueMargin, yPos);
        
        yPos += 15;
        
        // Available Cash Limit
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.text('Available Cash Limit', leftMargin, yPos);
        doc.setFont(undefined, 'normal');
        doc.text('Rs. ' + (item['Available Cash Limit'] || 'N/A'), valueMargin, yPos);
        
        yPos += 15;
        
        // Payment Due Date
        doc.setFillColor(250, 250, 250);
        doc.rect(16, yPos - 5, 170, 12, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.text('Payment Due Date', leftMargin, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(item['Payment Due Date'] || 'N/A', valueMargin, yPos);
        
        yPos += 15;
        
        // Total Outstanding
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.text('Total Outstanding', leftMargin, yPos);
        doc.setFont(undefined, 'normal');
        doc.text('Rs. ' + (item['Total Outstanding'] || 'N/A'), valueMargin, yPos);
        
        yPos += 15;
        
        // Reward Points / Minimum Amount Due
        const lastFieldLabel = bank === 'HDFC' ? 'Minimum Amount Due' : 'Reward Points Earned';
        doc.setFillColor(250, 250, 250);
        doc.rect(16, yPos - 5, 170, 12, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(lastFieldLabel, leftMargin, yPos);
        doc.setFont(undefined, 'normal');
        const lastFieldValue = bank === 'HDFC' ? 'Rs. ' + (item['Reward Points Earned'] || 'N/A') : (item['Reward Points Earned'] || 'N/A');
        doc.text(lastFieldValue, valueMargin, yPos);
        
        // Important Notice
        yPos = 200;
        doc.setFillColor(255, 243, 205);
        doc.rect(15, yPos, 180, 25, 'F');
        doc.setDrawColor(255, 193, 7);
        doc.setLineWidth(0.5);
        doc.rect(15, yPos, 180, 25, 'S');
        
        doc.setTextColor(133, 100, 4);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('IMPORTANT:', 20, yPos + 7);
        doc.setFont(undefined, 'normal');
        doc.text('Please ensure timely payment to avoid late fees and maintain good credit score.', 20, yPos + 14);
        doc.text(`For queries, contact ${bank} Credit Card customer care.`, 20, yPos + 20);
        
        // Footer
        doc.setFillColor(...darkGray);
        doc.rect(0, 270, 210, 27, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text('This is a computer-generated document. No signature required.', 105, 280, { align: 'center' });
        doc.text(`Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 105, 286, { align: 'center' });
        doc.setFontSize(7);
        doc.text('© 2025 Credit Statement Parser - All Rights Reserved', 105, 291, { align: 'center' });
    });
    
    doc.save(`all_statements_${new Date().toISOString().split('T')[0]}.pdf`);
    showSuccess(`✓ Combined PDF downloaded with ${data.length} statement(s)`);
}


function displayResults(data) {
    results.innerHTML = '';
    
    // Add summary header with bank breakdown
    const bankCounts = {};
    data.forEach(item => {
        const bank = item['Bank'] || 'UNKNOWN';
        bankCounts[bank] = (bankCounts[bank] || 0) + 1;
    });
    
    const bankSummary = Object.entries(bankCounts)
        .map(([bank, count]) => `${bank}: ${count}`)
        .join(' | ');
    
    const summary = document.createElement('div');
    summary.style.cssText = 'background: #e8f5e9; padding: 15px; border-radius: 6px; margin-bottom: 20px; text-align: center;';
    summary.innerHTML = `
        <strong>📊 Total Processed Files: ${data.length}</strong>
        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
            ${bankSummary}
        </p>
        <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">
            You can add more files and process them to merge with these results
        </p>
    `;
    results.appendChild(summary);
    
    data.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'result-card';
        
        const title = item.File || 'Statement';
        const escapedTitle = title.replace(/'/g, "\\'");
        const bank = item['Bank'] || 'UNKNOWN';
        
        // Bank-specific colors
        const bankColors = {
            'SBI': '#1976d2',
            'HDFC': '#d32f2f',
            'UNKNOWN': '#757575'
        };
        
        const bankColor = bankColors[bank] || '#757575';
        
        // Determine the last field label based on bank
        const lastFieldLabel = bank === 'HDFC' ? 'Minimum Amount Due (Rs.)' : 'Reward Points Earned';
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 10px;">
                <h3 style="margin: 0; flex: 1;">${title}</h3>
                <span style="background: ${bankColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">${bank}</span>
                <span class="remove-file" onclick="removeResult('${escapedTitle}')" style="cursor: pointer; color: #e74c3c; font-size: 18px;">✕</span>
            </div>
            <div class="result-grid">
                <div class="result-field">
                    <div class="field-label">Available Credit Limit (Rs.)</div>
                    <div class="field-value">${item['Available Credit Limit'] || 'N/A'}</div>
                </div>
                <div class="result-field">
                    <div class="field-label">Available Cash Limit (Rs.)</div>
                    <div class="field-value">${item['Available Cash Limit'] || 'N/A'}</div>
                </div>
                <div class="result-field">
                    <div class="field-label">Payment Due Date</div>
                    <div class="field-value">${item['Payment Due Date'] || 'N/A'}</div>
                </div>
                <div class="result-field">
                    <div class="field-label">Total Outstanding (Rs.)</div>
                    <div class="field-value">${item['Total Outstanding'] || 'N/A'}</div>
                </div>
                <div class="result-field">
                    <div class="field-label">${lastFieldLabel}</div>
                    <div class="field-value">${item['Reward Points Earned'] || 'N/A'}</div>
                </div>
            </div>
        `;
        
        // Create download button dynamically
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn-primary';
        downloadBtn.style.cssText = 'width: 30%; margin: 15px 0;';
        downloadBtn.textContent = '⬇ Download PDF';
        downloadBtn.onclick = () => downloadPDF(item, index);
        
        card.appendChild(downloadBtn);
        results.appendChild(card);
    });
    
    // Add download all buttons 
    if (data.length > 0) {
        const downloadSection = document.createElement('div');
        downloadSection.style.cssText = 'display: flex; justify-content: left; gap: 30px; margin:20px 15px;';
        
        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'btn-primary export-btn';
        pdfBtn.style.cssText = 'background: #33cb36ff; width: 35%;';
        pdfBtn.textContent = '⬇ Download Merged PDF';
        pdfBtn.onclick = () => downloadAllPDF(extractedData);
        
        downloadSection.appendChild(pdfBtn);
        results.appendChild(downloadSection);
    }
    
    resultsSection.classList.add('show');
}


function removeResult(filename) {
    if (confirm(`Remove "${filename}" from results?`)) {
        extractedData = extractedData.filter(item => item.File !== filename);
        
        if (extractedData.length > 0) {
            saveToLocalStorage();
            displayResults(extractedData);
            showSuccess(`Removed "${filename}"`);
        } else {
            localStorage.removeItem('extractedData');
            results.innerHTML = '';
            resultsSection.classList.remove('show');
            showSuccess('All results cleared');
        }
    }
}

function resetForm() {
    if (confirm('Are you sure you want to clear all data? This will remove saved results.')) {
        uploadedFiles = [];
        extractedData = [];
        
        localStorage.removeItem('extractedData');
        
        fileList.innerHTML = '';
        fileInput.value = '';
        results.innerHTML = '';
        resultsSection.classList.remove('show');
        errorMsg.classList.remove('show');
        successMsg.classList.remove('show');
        
        showSuccess('All data cleared');
    }
}
