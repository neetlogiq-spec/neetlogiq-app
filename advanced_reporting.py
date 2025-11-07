#!/usr/bin/env python3
"""
Comprehensive Reporting System
Generate PDF, HTML, Excel reports with charts and analytics
"""

import pandas as pd
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import logging
import json

logger = logging.getLogger(__name__)

class ReportGenerator:
    """Generate comprehensive matching reports"""

    def __init__(self, db_path: str, output_dir: str = 'reports'):
        """
        Initialize report generator

        Args:
            db_path: Database path
            output_dir: Output directory for reports
        """
        self.db_path = db_path
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_summary_report(
        self,
        format: str = 'html',
        include_charts: bool = True
    ) -> str:
        """
        Generate summary report

        Args:
            format: 'html', 'pdf', 'excel', or 'json'
            include_charts: Include visualizations

        Returns:
            Path to generated report
        """
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        if format == 'html':
            return self._generate_html_report(timestamp, include_charts)
        elif format == 'pdf':
            return self._generate_pdf_report(timestamp, include_charts)
        elif format == 'excel':
            return self._generate_excel_report(timestamp)
        elif format == 'json':
            return self._generate_json_report(timestamp)
        else:
            raise ValueError(f"Unknown format: {format}")

    def _get_report_data(self) -> Dict:
        """Gather all data for report"""
        conn = sqlite3.connect(self.db_path)

        data = {
            'summary': self._get_summary_stats(conn),
            'state_breakdown': self._get_state_breakdown(conn),
            'method_performance': self._get_method_performance(conn),
            'quality_metrics': self._get_quality_metrics(conn),
            'unmatched_analysis': self._get_unmatched_analysis(conn),
            'top_matches': self._get_top_matches(conn),
            'timestamp': datetime.now().isoformat()
        }

        conn.close()
        return data

    def _get_summary_stats(self, conn) -> Dict:
        """Get summary statistics"""
        cursor = conn.cursor()

        # Total records
        cursor.execute("SELECT COUNT(*) FROM seat_data")
        total = cursor.fetchone()[0]

        # Matched
        cursor.execute("SELECT COUNT(*) FROM seat_data WHERE is_linked = 1")
        matched = cursor.fetchone()[0]

        # Average scores
        cursor.execute("""
            SELECT
                AVG(college_match_score) as avg_college_score,
                AVG(course_match_score) as avg_course_score
            FROM seat_data
            WHERE is_linked = 1
        """)
        scores = cursor.fetchone()

        # Validation status
        cursor.execute("""
            SELECT
                validation_status,
                COUNT(*) as count
            FROM seat_data
            WHERE is_linked = 1
            GROUP BY validation_status
        """)
        validation = dict(cursor.fetchall())

        return {
            'total_records': total,
            'matched_records': matched,
            'unmatched_records': total - matched,
            'match_rate': (matched / total * 100) if total > 0 else 0,
            'avg_college_score': scores[0] if scores[0] else 0,
            'avg_course_score': scores[1] if scores[1] else 0,
            'validation_breakdown': validation
        }

    def _get_state_breakdown(self, conn) -> pd.DataFrame:
        """Get state-wise breakdown"""
        query = """
            SELECT
                state,
                COUNT(*) as total,
                SUM(CASE WHEN is_linked = 1 THEN 1 ELSE 0 END) as matched,
                ROUND(100.0 * SUM(CASE WHEN is_linked = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as match_rate,
                AVG(CASE WHEN is_linked = 1 THEN college_match_score ELSE NULL END) as avg_score
            FROM seat_data
            GROUP BY state
            ORDER BY match_rate DESC
        """
        return pd.read_sql(query, conn)

    def _get_method_performance(self, conn) -> pd.DataFrame:
        """Get matching method performance"""
        query = """
            SELECT
                college_match_method as method,
                COUNT(*) as count,
                AVG(college_match_score) as avg_score,
                MIN(college_match_score) as min_score,
                MAX(college_match_score) as max_score
            FROM seat_data
            WHERE is_linked = 1 AND college_match_method IS NOT NULL
            GROUP BY college_match_method
            ORDER BY count DESC
        """
        return pd.read_sql(query, conn)

    def _get_quality_metrics(self, conn) -> Dict:
        """Get data quality metrics"""
        cursor = conn.cursor()

        # Confidence distribution
        cursor.execute("""
            SELECT
                CASE
                    WHEN college_match_score >= 0.9 THEN 'High (>=90%)'
                    WHEN college_match_score >= 0.7 THEN 'Medium (70-90%)'
                    ELSE 'Low (<70%)'
                END as confidence_level,
                COUNT(*) as count
            FROM seat_data
            WHERE is_linked = 1
            GROUP BY confidence_level
        """)
        confidence_dist = dict(cursor.fetchall())

        return {
            'confidence_distribution': confidence_dist
        }

    def _get_unmatched_analysis(self, conn) -> Dict:
        """Analyze unmatched records"""
        cursor = conn.cursor()

        cursor.execute("""
            SELECT COUNT(*) FROM seat_data WHERE is_linked = 0
        """)
        total_unmatched = cursor.fetchone()[0]

        # Common patterns in unmatched
        cursor.execute("""
            SELECT state, COUNT(*) as count
            FROM seat_data
            WHERE is_linked = 0
            GROUP BY state
            ORDER BY count DESC
            LIMIT 5
        """)
        unmatched_by_state = cursor.fetchall()

        return {
            'total_unmatched': total_unmatched,
            'top_unmatched_states': dict(unmatched_by_state)
        }

    def _get_top_matches(self, conn, limit: int = 10) -> pd.DataFrame:
        """Get top quality matches"""
        query = f"""
            SELECT
                college_name,
                course_name,
                state,
                college_match_score,
                course_match_score,
                college_match_method
            FROM seat_data
            WHERE is_linked = 1
            ORDER BY (college_match_score + course_match_score) / 2 DESC
            LIMIT {limit}
        """
        return pd.read_sql(query, conn)

    def _generate_html_report(self, timestamp: str, include_charts: bool) -> str:
        """Generate HTML report"""
        data = self._get_report_data()

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>College Matching Report - {timestamp}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                h1 {{ color: #2c3e50; }}
                h2 {{ color: #34495e; border-bottom: 2px solid #3498db; padding-bottom: 5px; }}
                table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
                th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
                th {{ background-color: #3498db; color: white; }}
                tr:nth-child(even) {{ background-color: #f2f2f2; }}
                .metric {{ display: inline-block; margin: 10px; padding: 15px; background: #ecf0f1; border-radius: 5px; }}
                .metric-value {{ font-size: 24px; font-weight: bold; color: #2980b9; }}
                .metric-label {{ font-size: 14px; color: #7f8c8d; }}
            </style>
        </head>
        <body>
            <h1>🏥 College Matching Report</h1>
            <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>

            <h2>Executive Summary</h2>
            <div class="metric">
                <div class="metric-value">{data['summary']['total_records']:,}</div>
                <div class="metric-label">Total Records</div>
            </div>
            <div class="metric">
                <div class="metric-value">{data['summary']['matched_records']:,}</div>
                <div class="metric-label">Matched Records</div>
            </div>
            <div class="metric">
                <div class="metric-value">{data['summary']['match_rate']:.1f}%</div>
                <div class="metric-label">Match Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">{data['summary']['avg_college_score']:.2%}</div>
                <div class="metric-label">Avg College Score</div>
            </div>

            <h2>State-wise Breakdown</h2>
            {data['state_breakdown'].to_html(index=False)}

            <h2>Matching Method Performance</h2>
            {data['method_performance'].to_html(index=False)}

            <h2>Quality Metrics</h2>
            <table>
                <tr><th>Confidence Level</th><th>Count</th></tr>
        """

        for level, count in data['quality_metrics']['confidence_distribution'].items():
            html += f"<tr><td>{level}</td><td>{count:,}</td></tr>"

        html += f"""
            </table>

            <h2>Unmatched Analysis</h2>
            <p><strong>Total Unmatched:</strong> {data['unmatched_analysis']['total_unmatched']:,}</p>
            <table>
                <tr><th>State</th><th>Unmatched Count</th></tr>
        """

        for state, count in data['unmatched_analysis']['top_unmatched_states'].items():
            html += f"<tr><td>{state}</td><td>{count:,}</td></tr>"

        html += """
            </table>

            <h2>Top Quality Matches</h2>
        """

        html += data['top_matches'].to_html(index=False)

        html += """
            <footer>
                <p style="text-align: center; color: #7f8c8d; margin-top: 40px;">
                    Generated by Advanced College Matching System
                </p>
            </footer>
        </body>
        </html>
        """

        output_path = self.output_dir / f'report_{timestamp}.html'
        with open(output_path, 'w') as f:
            f.write(html)

        logger.info(f"HTML report generated: {output_path}")
        return str(output_path)

    def _generate_pdf_report(self, timestamp: str, include_charts: bool) -> str:
        """Generate PDF report"""
        try:
            from weasyprint import HTML

            # First generate HTML
            html_path = self._generate_html_report(timestamp, include_charts)

            # Convert to PDF
            output_path = self.output_dir / f'report_{timestamp}.pdf'
            HTML(html_path).write_pdf(output_path)

            logger.info(f"PDF report generated: {output_path}")
            return str(output_path)

        except ImportError:
            logger.error("WeasyPrint not installed. Install: pip install weasyprint")
            logger.info("Generating HTML report instead...")
            return self._generate_html_report(timestamp, include_charts)

    def _generate_excel_report(self, timestamp: str) -> str:
        """Generate Excel report with multiple sheets"""
        data = self._get_report_data()

        output_path = self.output_dir / f'report_{timestamp}.xlsx'

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary sheet
            summary_df = pd.DataFrame([data['summary']])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # State breakdown
            data['state_breakdown'].to_excel(writer, sheet_name='State Breakdown', index=False)

            # Method performance
            data['method_performance'].to_excel(writer, sheet_name='Method Performance', index=False)

            # Top matches
            data['top_matches'].to_excel(writer, sheet_name='Top Matches', index=False)

        logger.info(f"Excel report generated: {output_path}")
        return str(output_path)

    def _generate_json_report(self, timestamp: str) -> str:
        """Generate JSON report"""
        data = self._get_report_data()

        # Convert DataFrames to dicts
        data['state_breakdown'] = data['state_breakdown'].to_dict('records')
        data['method_performance'] = data['method_performance'].to_dict('records')
        data['top_matches'] = data['top_matches'].to_dict('records')

        output_path = self.output_dir / f'report_{timestamp}.json'

        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2, default=str)

        logger.info(f"JSON report generated: {output_path}")
        return str(output_path)

    def generate_scheduled_report(
        self,
        schedule: str = 'daily',
        formats: List[str] = ['html', 'excel']
    ):
        """Generate scheduled reports"""
        logger.info(f"Generating scheduled {schedule} report...")

        for format in formats:
            try:
                path = self.generate_summary_report(format=format)
                logger.info(f"Generated {format} report: {path}")
            except Exception as e:
                logger.error(f"Error generating {format} report: {e}")


# Standalone usage
if __name__ == "__main__":
    # Initialize reporter
    reporter = ReportGenerator('data/sqlite/seat_data.db')

    # Generate reports
    print("Generating reports...")

    html_report = reporter.generate_summary_report(format='html')
    print(f"HTML Report: {html_report}")

    excel_report = reporter.generate_summary_report(format='excel')
    print(f"Excel Report: {excel_report}")

    json_report = reporter.generate_summary_report(format='json')
    print(f"JSON Report: {json_report}")
