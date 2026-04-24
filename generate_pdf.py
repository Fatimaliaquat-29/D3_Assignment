# Requirements: pip install fpdf

from fpdf import FPDF

# =========================================================
# TODO: Fill in your details here before running the script
# =========================================================
STUDENT_NAME = "Fatima Liaquat"
STUDENT_ID = "2023202"
GITHUB_PAGES_LINK = "https://fatimaliaquat-29.github.io/D3_Assignment/"
# =========================================================

# Dataset description
DATASET_DESC = (
    "The Pokémon stats dataset contains base stats for over 1000 Pokémon (1005 entries) across various "
    "generations, including HP, Attack, Defense, Sp. Atk, Sp. Def, Speed, and a total "
    "base stat sum. It includes typing and legendary status, making it ideal for multi-dimensional analysis."
)

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(0, 10, 'Assignment 3: Interactive Data Visualization', 0, 1, 'C')
        self.ln(10)

def create_submission_pdf():
    pdf = PDF()
    pdf.add_page()
    
    # Name and ID
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 10, f'Name: {STUDENT_NAME}', 0, 1)
    pdf.cell(0, 10, f'Student ID: {STUDENT_ID}', 0, 1)
    pdf.ln(5)
    
    # Dataset Description
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 10, 'Dataset Description:', 0, 1)
    pdf.set_font('Arial', '', 12)
    pdf.multi_cell(0, 10, DATASET_DESC)
    pdf.ln(5)
    
    # GitHub Pages Link
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 10, 'Visualization Link:', 0, 1)
    pdf.set_font('Arial', '', 12)
    pdf.set_text_color(0, 0, 255)
    pdf.cell(0, 10, GITHUB_PAGES_LINK, 0, 1, link=GITHUB_PAGES_LINK)
    
    # Save the PDF
    output_filename = f'A3_{STUDENT_ID}.pdf'
    pdf.output(output_filename, 'F')
    print(f"Successfully generated {output_filename}")

if __name__ == "__main__":
    create_submission_pdf()
