-- Create counselling_documents table for managing MCC and KEA documents
CREATE TABLE IF NOT EXISTS counselling_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  counselling_body TEXT NOT NULL CHECK (counselling_body IN ('MCC', 'KEA')),
  file_url TEXT NOT NULL,
  official_url TEXT NOT NULL,
  upload_date DATE NOT NULL DEFAULT CURRENT_DATE,
  file_size TEXT NOT NULL,
  downloads INTEGER DEFAULT 0,
  icon_type TEXT DEFAULT 'FileText',
  color TEXT DEFAULT 'from-blue-500 to-cyan-500',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_counselling_documents_body ON counselling_documents(counselling_body);
CREATE INDEX IF NOT EXISTS idx_counselling_documents_category ON counselling_documents(category);
CREATE INDEX IF NOT EXISTS idx_counselling_documents_created_at ON counselling_documents(created_at DESC);

-- Enable Row Level Security
ALTER TABLE counselling_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read documents
CREATE POLICY "Public documents are viewable by everyone"
  ON counselling_documents FOR SELECT
  USING (true);

-- Policy: Only authenticated users can insert documents
CREATE POLICY "Authenticated users can insert documents"
  ON counselling_documents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Policy: Only authenticated users can update documents
CREATE POLICY "Authenticated users can update documents"
  ON counselling_documents FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Policy: Only authenticated users can delete documents
CREATE POLICY "Authenticated users can delete documents"
  ON counselling_documents FOR DELETE
  USING (auth.role() = 'authenticated');

-- Insert sample MCC documents
INSERT INTO counselling_documents (title, category, counselling_body, file_url, official_url, upload_date, file_size, downloads, icon_type, color) VALUES
('NEET UG 2024 Seat Matrix - Round 1', 'Seat Matrix', 'MCC', '/documents/mcc-seat-matrix-2024.pdf', 'https://mcc.nic.in/WebInfo/Page/Page?PageId=1&LangId=P', '2024-06-15', '12.5 MB', 45231, 'FileText', 'from-blue-500 to-cyan-500'),
('Round 1 Schedule & Important Dates', 'Schedule', 'MCC', '/documents/mcc-round1-schedule.pdf', 'https://mcc.nic.in/WebInfo/Page/Page?PageId=2&LangId=P', '2024-06-10', '2.1 MB', 38450, 'Calendar', 'from-purple-500 to-pink-500'),
('Document Verification Guidelines', 'Guidelines', 'MCC', '/documents/mcc-document-guidelines.pdf', 'https://mcc.nic.in/WebInfo/Page/Page?PageId=3&LangId=P', '2024-06-05', '5.8 MB', 29340, 'FileCheck', 'from-green-500 to-teal-500'),
('NEET UG 2024 Information Bulletin', 'Information', 'MCC', '/documents/mcc-information-bulletin.pdf', 'https://mcc.nic.in/WebInfo/Page/Page?PageId=4&LangId=P', '2024-05-20', '8.3 MB', 56120, 'FileText', 'from-orange-500 to-red-500');

-- Insert sample KEA documents
INSERT INTO counselling_documents (title, category, counselling_body, file_url, official_url, upload_date, file_size, downloads, icon_type, color) VALUES
('Karnataka CET 2024 Seat Matrix', 'Seat Matrix', 'KEA', '/documents/kea-seat-matrix-2024.pdf', 'https://kea.kar.nic.in/ugmedical2024/seat_matrix.aspx', '2024-06-20', '8.2 MB', 28450, 'FileText', 'from-purple-500 to-pink-500'),
('KEA Counselling Schedule 2024', 'Schedule', 'KEA', '/documents/kea-schedule-2024.pdf', 'https://kea.kar.nic.in/ugmedical2024/schedule.aspx', '2024-06-18', '1.9 MB', 22130, 'Calendar', 'from-blue-500 to-cyan-500');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update updated_at on row update
CREATE TRIGGER update_counselling_documents_updated_at BEFORE UPDATE
  ON counselling_documents FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE counselling_documents IS 'Stores counselling documents for MCC and KEA with metadata';
COMMENT ON COLUMN counselling_documents.counselling_body IS 'Either MCC or KEA';
COMMENT ON COLUMN counselling_documents.file_url IS 'Internal file URL for preview';
COMMENT ON COLUMN counselling_documents.official_url IS 'Official government website URL';
COMMENT ON COLUMN counselling_documents.downloads IS 'Number of times document was downloaded/viewed';
COMMENT ON COLUMN counselling_documents.icon_type IS 'Lucide icon name (FileText, Calendar, FileCheck, etc.)';
COMMENT ON COLUMN counselling_documents.color IS 'Tailwind gradient classes for visual theming';
