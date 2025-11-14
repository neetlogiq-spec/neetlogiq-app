-- =====================================================
-- Foundation Data Population Script
-- Populates master reference tables with initial data
-- Run AFTER applying the unified schema migration
-- =====================================================

-- =====================================================
-- STATES DATA
-- =====================================================

INSERT INTO states (id, name, code, region, normalized_name) VALUES
('ST001', 'Andhra Pradesh', 'AP', 'South', 'andhra pradesh'),
('ST002', 'Arunachal Pradesh', 'AR', 'Northeast', 'arunachal pradesh'),
('ST003', 'Assam', 'AS', 'Northeast', 'assam'),
('ST004', 'Bihar', 'BR', 'East', 'bihar'),
('ST005', 'Chhattisgarh', 'CG', 'Central', 'chhattisgarh'),
('ST006', 'Goa', 'GA', 'West', 'goa'),
('ST007', 'Gujarat', 'GJ', 'West', 'gujarat'),
('ST008', 'Haryana', 'HR', 'North', 'haryana'),
('ST009', 'Himachal Pradesh', 'HP', 'North', 'himachal pradesh'),
('ST010', 'Jharkhand', 'JH', 'East', 'jharkhand'),
('ST011', 'Karnataka', 'KA', 'South', 'karnataka'),
('ST012', 'Kerala', 'KL', 'South', 'kerala'),
('ST013', 'Madhya Pradesh', 'MP', 'Central', 'madhya pradesh'),
('ST014', 'Maharashtra', 'MH', 'West', 'maharashtra'),
('ST015', 'Manipur', 'MN', 'Northeast', 'manipur'),
('ST016', 'Meghalaya', 'ML', 'Northeast', 'meghalaya'),
('ST017', 'Mizoram', 'MZ', 'Northeast', 'mizoram'),
('ST018', 'Nagaland', 'NL', 'Northeast', 'nagaland'),
('ST019', 'Odisha', 'OR', 'East', 'odisha'),
('ST020', 'Punjab', 'PB', 'North', 'punjab'),
('ST021', 'Rajasthan', 'RJ', 'West', 'rajasthan'),
('ST022', 'Sikkim', 'SK', 'Northeast', 'sikkim'),
('ST023', 'Tamil Nadu', 'TN', 'South', 'tamil nadu'),
('ST024', 'Telangana', 'TS', 'South', 'telangana'),
('ST025', 'Tripura', 'TR', 'Northeast', 'tripura'),
('ST026', 'Uttar Pradesh', 'UP', 'North', 'uttar pradesh'),
('ST027', 'Uttarakhand', 'UK', 'North', 'uttarakhand'),
('ST028', 'West Bengal', 'WB', 'East', 'west bengal'),
('ST029', 'Delhi', 'DL', 'North', 'delhi'),
('ST030', 'Puducherry', 'PY', 'South', 'puducherry'),
('ST031', 'Jammu and Kashmir', 'JK', 'North', 'jammu and kashmir'),
('ST032', 'Ladakh', 'LA', 'North', 'ladakh'),
('ST033', 'Chandigarh', 'CH', 'North', 'chandigarh'),
('ST034', 'Dadra and Nagar Haveli and Daman and Diu', 'DD', 'West', 'dadra and nagar haveli and daman and diu'),
('ST035', 'Lakshadweep', 'LD', 'South', 'lakshadweep'),
('ST036', 'Andaman and Nicobar Islands', 'AN', 'South', 'andaman and nicobar islands')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    region = EXCLUDED.region,
    normalized_name = EXCLUDED.normalized_name,
    updated_at = NOW();

-- =====================================================
-- CATEGORIES DATA
-- =====================================================

INSERT INTO categories (id, name, code, normalized_name, description, is_reservation) VALUES
('CAT001', 'General', 'GEN', 'general', 'General category', false),
('CAT002', 'OBC-NCL', 'OBC', 'obc ncl', 'Other Backward Classes - Non Creamy Layer', true),
('CAT003', 'SC', 'SC', 'sc', 'Scheduled Caste', true),
('CAT004', 'ST', 'ST', 'st', 'Scheduled Tribe', true),
('CAT005', 'EWS', 'EWS', 'ews', 'Economically Weaker Section', true),
('CAT006', 'PwD', 'PWD', 'pwd', 'Persons with Disabilities', true),
('CAT007', 'General-PwD', 'GEN-PWD', 'general pwd', 'General with Disability', true),
('CAT008', 'OBC-PwD', 'OBC-PWD', 'obc pwd', 'OBC with Disability', true),
('CAT009', 'SC-PwD', 'SC-PWD', 'sc pwd', 'SC with Disability', true),
('CAT010', 'ST-PwD', 'ST-PWD', 'st pwd', 'ST with Disability', true),
('CAT011', 'EWS-PwD', 'EWS-PWD', 'ews pwd', 'EWS with Disability', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    normalized_name = EXCLUDED.normalized_name,
    description = EXCLUDED.description,
    is_reservation = EXCLUDED.is_reservation,
    updated_at = NOW();

-- =====================================================
-- QUOTAS DATA
-- =====================================================

INSERT INTO quotas (id, name, code, normalized_name, description) VALUES
('QTA001', 'All India Quota', 'AIQ', 'all india quota', 'All India Quota - 15% seats in government medical colleges'),
('QTA002', 'State Quota', 'SQ', 'state quota', 'State Quota - 85% seats for state domicile'),
('QTA003', 'Management Quota', 'MQ', 'management quota', 'Management/NRI Quota in private colleges'),
('QTA004', 'Deemed University Quota', 'DU', 'deemed university quota', 'Deemed University Quota'),
('QTA005', 'Central University Quota', 'CU', 'central university quota', 'Central University Quota'),
('QTA006', 'Jipmer Quota', 'JIPMER', 'jipmer quota', 'JIPMER Institute Quota'),
('QTA007', 'AIIMS Quota', 'AIIMS', 'aiims quota', 'AIIMS Institute Quota'),
('QTA008', 'Employee State Insurance Scheme', 'ESIC', 'esic', 'ESIC Quota'),
('QTA009', 'Delhi University', 'DU-DELHI', 'delhi university', 'Delhi University Quota'),
('QTA010', 'Aligarh Muslim University', 'AMU', 'amu', 'AMU Internal Quota'),
('QTA011', 'Banaras Hindu University', 'BHU', 'bhu', 'BHU Internal Quota'),
('QTA012', 'DNB Quota', 'DNB', 'dnb quota', 'Diplomat of National Board Quota')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    normalized_name = EXCLUDED.normalized_name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- =====================================================
-- SOURCES DATA
-- =====================================================

INSERT INTO sources (id, name) VALUES
('SRC001', 'AIQ'),
('SRC002', 'KEA'),
('SRC003', 'STATE'),
('SRC004', 'MCC'),
('SRC005', 'DGHS'),
('SRC006', 'NBEMS'),
('SRC007', 'MANUAL')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

-- =====================================================
-- LEVELS DATA
-- =====================================================

INSERT INTO levels (id, name) VALUES
('LVL001', 'UG'),
('LVL002', 'PG'),
('LVL003', 'DEN'),
('LVL004', 'DNB'),
('LVL005', 'DIPLOMA')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

-- =====================================================
-- COURSES DATA (Common courses) - Using master_courses table
-- =====================================================

INSERT INTO master_courses (id, name, code, normalized_name, level, domain, duration_years, description) VALUES
-- UG Medical
('CRS001', 'MBBS', 'MBBS', 'mbbs', 'UG', 'MEDICAL', 5, 'Bachelor of Medicine and Bachelor of Surgery'),

-- UG Dental
('CRS002', 'BDS', 'BDS', 'bds', 'UG', 'DENTAL', 5, 'Bachelor of Dental Surgery'),

-- PG Medical - Broad Specialties
('CRS003', 'MD (General Medicine)', 'MD-GENMED', 'md general medicine', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in General Medicine'),
('CRS004', 'MD (Pediatrics)', 'MD-PEDIA', 'md pediatrics', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in Pediatrics'),
('CRS005', 'MD (Pathology)', 'MD-PATH', 'md pathology', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in Pathology'),
('CRS006', 'MD (Microbiology)', 'MD-MICRO', 'md microbiology', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in Microbiology'),
('CRS007', 'MD (Biochemistry)', 'MD-BIOCHEM', 'md biochemistry', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in Biochemistry'),
('CRS008', 'MD (Pharmacology)', 'MD-PHARMA', 'md pharmacology', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in Pharmacology'),
('CRS009', 'MD (Physiology)', 'MD-PHYSIO', 'md physiology', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in Physiology'),
('CRS010', 'MD (Anatomy)', 'MD-ANAT', 'md anatomy', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in Anatomy'),
('CRS011', 'MD (Forensic Medicine)', 'MD-FOREN', 'md forensic medicine', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in Forensic Medicine'),
('CRS012', 'MD (Community Medicine)', 'MD-COMMMED', 'md community medicine', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in Community Medicine'),
('CRS013', 'MD (Dermatology)', 'MD-DERMA', 'md dermatology', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in Dermatology'),
('CRS014', 'MD (Psychiatry)', 'MD-PSYCH', 'md psychiatry', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in Psychiatry'),
('CRS015', 'MD (Radio-Diagnosis)', 'MD-RADIO', 'md radio diagnosis', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in Radio-Diagnosis'),
('CRS016', 'MD (Anesthesiology)', 'MD-ANESTH', 'md anesthesiology', 'PG', 'MEDICAL', 3, 'Doctor of Medicine in Anesthesiology'),

-- PG Medical - MS Specialties
('CRS017', 'MS (General Surgery)', 'MS-GENSURG', 'ms general surgery', 'PG', 'MEDICAL', 3, 'Master of Surgery in General Surgery'),
('CRS018', 'MS (Orthopedics)', 'MS-ORTHO', 'ms orthopedics', 'PG', 'MEDICAL', 3, 'Master of Surgery in Orthopedics'),
('CRS019', 'MS (Ophthalmology)', 'MS-OPHTHAL', 'ms ophthalmology', 'PG', 'MEDICAL', 3, 'Master of Surgery in Ophthalmology'),
('CRS020', 'MS (ENT)', 'MS-ENT', 'ms ent', 'PG', 'MEDICAL', 3, 'Master of Surgery in ENT'),
('CRS021', 'MS (Obstetrics & Gynecology)', 'MS-OBGYN', 'ms obstetrics gynecology', 'PG', 'MEDICAL', 3, 'Master of Surgery in Obstetrics & Gynecology'),

-- PG Dental
('CRS022', 'MDS (Orthodontics)', 'MDS-ORTHO', 'mds orthodontics', 'PG', 'DENTAL', 3, 'Master of Dental Surgery in Orthodontics'),
('CRS023', 'MDS (Periodontics)', 'MDS-PERIO', 'mds periodontics', 'PG', 'DENTAL', 3, 'Master of Dental Surgery in Periodontics'),
('CRS024', 'MDS (Prosthodontics)', 'MDS-PROSTH', 'mds prosthodontics', 'PG', 'DENTAL', 3, 'Master of Dental Surgery in Prosthodontics'),
('CRS025', 'MDS (Oral Surgery)', 'MDS-ORALSURG', 'mds oral surgery', 'PG', 'DENTAL', 3, 'Master of Dental Surgery in Oral Surgery'),
('CRS026', 'MDS (Oral Pathology)', 'MDS-ORALPATH', 'mds oral pathology', 'PG', 'DENTAL', 3, 'Master of Dental Surgery in Oral Pathology'),
('CRS027', 'MDS (Conservative Dentistry)', 'MDS-CONSERV', 'mds conservative dentistry', 'PG', 'DENTAL', 3, 'Master of Dental Surgery in Conservative Dentistry'),
('CRS028', 'MDS (Pediatric Dentistry)', 'MDS-PEDO', 'mds pediatric dentistry', 'PG', 'DENTAL', 3, 'Master of Dental Surgery in Pediatric Dentistry'),

-- DNB Courses
('CRS029', 'DNB (General Medicine)', 'DNB-GENMED', 'dnb general medicine', 'PG', 'DNB', 3, 'Diplomate of National Board in General Medicine'),
('CRS030', 'DNB (General Surgery)', 'DNB-GENSURG', 'dnb general surgery', 'PG', 'DNB', 3, 'Diplomate of National Board in General Surgery'),
('CRS031', 'DNB (Pediatrics)', 'DNB-PEDIA', 'dnb pediatrics', 'PG', 'DNB', 3, 'Diplomate of National Board in Pediatrics'),
('CRS032', 'DNB (Obstetrics & Gynecology)', 'DNB-OBGYN', 'dnb obstetrics gynecology', 'PG', 'DNB', 3, 'Diplomate of National Board in Obstetrics & Gynecology'),
('CRS033', 'DNB (Orthopedics)', 'DNB-ORTHO', 'dnb orthopedics', 'PG', 'DNB', 3, 'Diplomate of National Board in Orthopedics'),
('CRS034', 'DNB (Ophthalmology)', 'DNB-OPHTHAL', 'dnb ophthalmology', 'PG', 'DNB', 3, 'Diplomate of National Board in Ophthalmology'),
('CRS035', 'DNB (ENT)', 'DNB-ENT', 'dnb ent', 'PG', 'DNB', 3, 'Diplomate of National Board in ENT'),
('CRS036', 'DNB (Anesthesiology)', 'DNB-ANESTH', 'dnb anesthesiology', 'PG', 'DNB', 3, 'Diplomate of National Board in Anesthesiology'),

-- Diploma Courses
('CRS037', 'Diploma in Child Health', 'DCH', 'dch', 'DIPLOMA', 'MEDICAL', 2, 'Diploma in Child Health'),
('CRS038', 'Diploma in Obstetrics & Gynecology', 'DGO', 'dgo', 'DIPLOMA', 'MEDICAL', 2, 'Diploma in Obstetrics & Gynecology'),
('CRS039', 'Diploma in Anesthesia', 'DA', 'da', 'DIPLOMA', 'MEDICAL', 2, 'Diploma in Anesthesia'),
('CRS040', 'Diploma in Orthopedics', 'D-ORTHO', 'diploma orthopedics', 'DIPLOMA', 'MEDICAL', 2, 'Diploma in Orthopedics')

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    normalized_name = EXCLUDED.normalized_name,
    level = EXCLUDED.level,
    domain = EXCLUDED.domain,
    duration_years = EXCLUDED.duration_years,
    description = EXCLUDED.description,
    updated_at = NOW();

-- =====================================================
-- STREAM CONFIGURATIONS (for application)
-- =====================================================

INSERT INTO stream_configurations (stream_id, stream_name, stream_description, is_enabled, requires_subscription, priority, metadata) VALUES
('UG', 'Undergraduate Medical (NEET UG)', 'MBBS and BDS courses through NEET UG counseling', true, false, 1, 
 '{"exam": "NEET UG", "courses": ["MBBS", "BDS"], "counseling_body": "MCC", "rounds": 4, "max_choices": 100}'::jsonb),
('PG_MEDICAL', 'Postgraduate Medical (NEET PG)', 'MD/MS courses through NEET PG counseling', true, true, 2,
 '{"exam": "NEET PG", "courses": ["MD", "MS", "PG Diploma"], "counseling_body": "MCC", "rounds": 3, "max_choices": 75}'::jsonb),
('DIPLOMA', 'Diploma in Medical/Dental', 'Diploma courses for medical and dental streams', true, true, 3,
 '{"exam": "NEET UG", "courses": ["Diploma in Medical", "Diploma in Dental"], "counseling_body": "State Councils", "rounds": 2, "max_choices": 50}'::jsonb),
('DNB', 'DNB Postgraduate', 'DNB courses through NBEMS counseling', true, true, 4,
 '{"exam": "NEET PG", "courses": ["DNB"], "counseling_body": "NBEMS", "rounds": 3, "max_choices": 75}'::jsonb)
ON CONFLICT (stream_id) DO UPDATE SET
    stream_name = EXCLUDED.stream_name,
    stream_description = EXCLUDED.stream_description,
    is_enabled = EXCLUDED.is_enabled,
    requires_subscription = EXCLUDED.requires_subscription,
    priority = EXCLUDED.priority,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- =====================================================
-- USER ROLES (for application)
-- =====================================================

INSERT INTO user_roles (role_name, role_description, permissions) VALUES
('super_admin', 'Super Administrator with full platform access',
 '{"can_manage_users": true, "can_manage_content": true, "can_manage_streams": true, "can_view_analytics": true, "can_manage_subscriptions": true, "can_access_admin_panel": true}'::jsonb),
('admin', 'Administrator with limited management access',
 '{"can_manage_content": true, "can_view_analytics": true, "can_access_admin_panel": true}'::jsonb),
('moderator', 'Content moderator',
 '{"can_manage_content": true, "can_access_admin_panel": true}'::jsonb),
('user', 'Regular platform user',
 '{"can_view_content": true, "can_create_profile": true}'::jsonb)
ON CONFLICT (role_name) DO UPDATE SET
    role_description = EXCLUDED.role_description,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify states
SELECT 'States inserted:', COUNT(*) FROM states;

-- Verify categories
SELECT 'Categories inserted:', COUNT(*) FROM categories;

-- Verify quotas
SELECT 'Quotas inserted:', COUNT(*) FROM quotas;

-- Verify sources
SELECT 'Sources inserted:', COUNT(*) FROM sources;

-- Verify levels
SELECT 'Levels inserted:', COUNT(*) FROM levels;

-- Verify courses
SELECT 'Courses inserted:', COUNT(*) FROM master_courses;

-- Verify stream configurations
SELECT 'Stream configurations inserted:', COUNT(*) FROM stream_configurations;

-- Verify user roles
SELECT 'User roles inserted:', COUNT(*) FROM user_roles;

SELECT '✅ Foundation data population complete!' as status;
