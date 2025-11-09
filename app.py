from flask import Flask, request, jsonify, send_file, render_template
from werkzeug.utils import secure_filename
import pymupdf as fitz
import re
import pandas as pd
import os
from io import BytesIO


app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'pdf'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def detect_bank(text):
    """Detect which bank issued the statement"""
    text_upper = text.upper()
    
    # HDFC has "HDFC" or "HDFC Bank" in the text
    if 'HDFC' in text_upper:
        return 'HDFC'
    # Otherwise assume SBI (since your SBI doesn't have bank name)
    else:
        return 'SBI'

def parse_sbi(text):
    """Parse SBI credit card statement"""
    limits_match = re.search(
        r"Available Credit Limit.*?Available Cash Limit.*?([\d,]+\.?\d*)\D+.*?([\d,]+\.?\d*)", 
        text, 
        re.DOTALL
    )
    
    if limits_match:
        available_credit_limit = limits_match.group(1)
        available_cash_limit = limits_match.group(2)
    else:
        available_credit_limit = None
        available_cash_limit = None
    
    payment_due_date = re.search(r"Payment Due Date\s*([\d]{1,2} \w{3} \d{4})", text)
    total_outstanding = re.search(r"Total Outstanding.*?([\d,]+\.?\d+)", text, re.DOTALL)
    reward_earned = re.search(r"REWARD SUMMARY.*?(\d+)\s+(\d+)\s+(\d+)\s+(\d+)", text, re.DOTALL)
    
    return {
        "Bank": "SBI",
        "Available Credit Limit": available_credit_limit,
        "Available Cash Limit": available_cash_limit,
        "Payment Due Date": payment_due_date.group(1) if payment_due_date else None,
        "Total Outstanding": total_outstanding.group(1) if total_outstanding else None,
        "Reward Points Earned": reward_earned.group(2) if reward_earned else None
    }

def parse_hdfc(text):
    """Parse HDFC credit card statement"""
    
    # Split into lines and remove empty ones
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Initialize all variables
    payment_due_date = None
    total_dues = None
    minimum_amount_due = None
    available_credit = None
    available_cash = None
    
    # Extract data using a simple approach
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Payment Due Date - value is 3 lines down
        if line == 'Payment Due Date':
            if i + 3 < len(lines):
                payment_due_date = lines[i + 3]
        
        # Total Dues - value is 3 lines down
        elif line == 'Total Dues':
            if i + 3 < len(lines):
                total_dues = lines[i + 3]
        
        # Minimum Amount Due - value is 3 lines down
        elif line == 'Minimum Amount Due':
            if i + 3 < len(lines):
                minimum_amount_due = lines[i + 3]
        
        # Available Credit Limit - value is 3 lines down
        elif line == 'Available Credit Limit':
            if i + 3 < len(lines):
                available_credit = lines[i + 3]
        
        # Available Cash Limit - value is 3 lines down
        elif line == 'Available Cash Limit':
            if i + 3 < len(lines):
                available_cash = lines[i + 3]
        
        i += 1
    
    return {
        "Bank": "HDFC",
        "Available Credit Limit": available_credit,
        "Available Cash Limit": available_cash,
        "Payment Due Date": payment_due_date,
        "Total Outstanding": total_dues,
        "Reward Points Earned": minimum_amount_due  # Changed to Minimum Amount Due
    }


def parse_statement(text):
    """Main parser that detects bank and routes to appropriate parser"""
    bank = detect_bank(text)
    
    if bank == 'SBI':
        return parse_sbi(text)
    elif bank == 'HDFC':
        return parse_hdfc(text)
    else:
        return {
            "Bank": "UNKNOWN",
            "Available Credit Limit": None,
            "Available Cash Limit": None,
            "Payment Due Date": None,
            "Total Outstanding": None,
            "Reward Points Earned": None
        }


@app.route('/api/extract', methods=['POST'])
def extract_pdf():
    """Upload PDF and extract data"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Only PDF files allowed'}), 400
    
    try:
        doc = fitz.open(stream=file.read(), filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
        
        extracted_data = parse_statement(text)
        
        return jsonify({
            'success': True,
            'filename': secure_filename(file.filename),
            'data': extracted_data
        }), 200
    
    except Exception as e:
        return jsonify({'error': f'Error processing PDF: {str(e)}'}), 500


@app.route('/api/extract-multiple', methods=['POST'])
def extract_multiple():
    """Upload multiple PDFs and extract data"""
    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400
    
    files = request.files.getlist('files')
    
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No files selected'}), 400
    
    results = []
    
    try:
        for file in files:
            if allowed_file(file.filename):
                doc = fitz.open(stream=file.read(), filetype="pdf")
                text = ""
                for page in doc:
                    text += page.get_text() + "\n"
                
                extracted_data = parse_statement(text)
                extracted_data['File'] = secure_filename(file.filename)
                results.append(extracted_data)
        
        return jsonify({
            'success': True,
            'count': len(results),
            'data': results,
            'csv_ready': True
        }), 200
    
    except Exception as e:
        return jsonify({'error': f'Error processing files: {str(e)}'}), 500


@app.route('/')
def index():
    return render_template('index.html')


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
