import xlsx from 'xlsx';

export interface ExcelRow {
  email: string;
  triggerDate: string;
  message: string;
}

export interface ParsedExcelData {
  data: ExcelRow[];
  errors: string[];
}

export class ExcelService {
  /**
   * Parse Excel file and extract email campaign data
   * Expected columns: email, triggerDate, message
   */
  static parseExcelFile(filePath: string): ParsedExcelData {
    const result: ParsedExcelData = {
      data: [],
      errors: []
    };

    try {
      // Read the Excel file
      const workbook = xlsx.readFile(filePath);

      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        result.errors.push('Excel file is empty or has no sheets');
        return result;
      }

      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const jsonData: any[] = xlsx.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        result.errors.push('Excel sheet is empty');
        return result;
      }

      // Process each row
      jsonData.forEach((row, index) => {
        const rowNumber = index + 2; // +2 because Excel is 1-indexed and first row is header

        // Validate required fields
        if (!row.email && !row.Email) {
          result.errors.push(`Row ${rowNumber}: Missing email column`);
          return;
        }

        if (!row.triggerDate && !row.TriggerDate && !row['Trigger Date']) {
          result.errors.push(`Row ${rowNumber}: Missing triggerDate column`);
          return;
        }

        if (!row.message && !row.Message) {
          result.errors.push(`Row ${rowNumber}: Missing message column`);
          return;
        }

        // Extract data (handle different case variations)
        const email = row.email || row.Email;
        const triggerDate = row.triggerDate || row.TriggerDate || row['Trigger Date'];
        const message = row.message || row.Message;

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          result.errors.push(`Row ${rowNumber}: Invalid email format (${email})`);
          return;
        }

        // Validate trigger date
        let formattedDate: string;
        if (typeof triggerDate === 'number') {
          // Excel date serial number
          const date = xlsx.SSF.parse_date_code(triggerDate);
          formattedDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')} ${String(date.H || 0).padStart(2, '0')}:${String(date.M || 0).padStart(2, '0')}`;
        } else {
          formattedDate = String(triggerDate);
        }

        // Add to results
        result.data.push({
          email: String(email).trim().toLowerCase(),
          triggerDate: formattedDate,
          message: String(message).trim()
        });
      });

      return result;

    } catch (error) {
      result.errors.push(`Error reading Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Validate date format (YYYY-MM-DD HH:MM)
   */
  static isValidDateFormat(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }
}
