#!/usr/bin/env python3
"""
GUARDIAN PIPELINE
Complete validation pipeline: Guardian Rules → LLM Council Verification

Usage:
    from guardian_pipeline import GuardianPipeline
    
    pipeline = GuardianPipeline()
    results = pipeline.run()
    
    # Or run from command line:
    python guardian_pipeline.py
"""

import sqlite3
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from guardian_validator import (
    GuardianValidator, 
    ValidationResult, 
    ValidationAction,
    MatchRecord,
)
from agentic_verifier import (
    AgenticVerifier,
    VerificationRecord,
    VerificationResult,
    VerificationVerdict,
)

logger = logging.getLogger(__name__)
console = Console()


@dataclass
class PipelineResult:
    """Complete pipeline result."""
    total_records: int
    
    # Guardian results
    guardian_pass: int
    guardian_quarantine: int
    guardian_block: int
    
    # LLM verification results
    llm_approved: int
    llm_rejected: int
    
    # Final counts
    final_approved: int  # guardian_pass + llm_approved
    final_rejected: int  # guardian_block + llm_rejected
    
    # Details
    guardian_results: Dict[str, List[ValidationResult]]
    verification_results: List[VerificationResult]


class GuardianPipeline:
    """
    Complete validation pipeline.
    
    Flow:
    1. Guardian Rules → PASS / QUARANTINE / BLOCK
    2. LLM Verifier → APPROVE / REJECT quarantine records
    3. Final: (PASS + LLM_APPROVED) = verified, (BLOCK + LLM_REJECTED) = rejected
    """
    
    def __init__(
        self,
        seat_db_path: str = 'data/sqlite/seat_data.db',
        master_db_path: str = 'data/sqlite/master_data.db',
        config_path: str = 'guardian_rules.yaml',
        api_keys: Optional[List[str]] = None,
        skip_llm_verification: bool = False,
    ):
        self.seat_db_path = seat_db_path
        self.master_db_path = master_db_path
        self.config_path = config_path
        self.api_keys = api_keys
        self.skip_llm_verification = skip_llm_verification
        
        # Initialize components
        self.guardian = GuardianValidator(
            seat_db_path=seat_db_path,
            master_db_path=master_db_path,
            rules_path=config_path,
        )
        
        if not skip_llm_verification:
            self.verifier = AgenticVerifier(
                seat_db_path=seat_db_path,
                master_db_path=master_db_path,
                config_path='config.yaml',  # Main config for API keys
                api_keys=api_keys,
            )
        else:
            self.verifier = None
    
    def _convert_to_verification_record(
        self, 
        validation: ValidationResult,
        match_records: Dict[str, MatchRecord],
    ) -> Optional[VerificationRecord]:
        """Convert a quarantined ValidationResult to VerificationRecord."""
        record = match_records.get(validation.record_id)
        if not record:
            return None
        
        return VerificationRecord(
            record_id=record.id,
            seat_college_name=record.college_name,
            seat_state=record.state,
            seat_address=record.address,
            seat_course_type=record.course_type,
            master_college_id=record.master_college_id,
            master_name=record.master_name or '',
            master_state=record.master_state or '',
            master_address=record.master_address,
            match_score=record.match_score,
            match_method=record.match_method,
        )
    
    def _delink_rejected_records(self, rejected_records: List[MatchRecord]) -> int:
        """
        Remove matched_college_id for rejected records in group_matching_queue.
        
        UPDATED: Uses attribute-based lookup to find correct group_id.
        
        Args:
            rejected_records: List of MatchRecord objects to delink
            
        Returns:
            Number of records delinked
        """
        if not rejected_records:
            return 0
        
        try:
            conn = sqlite3.connect(self.seat_db_path)
            cursor = conn.cursor()
            
            # Use attributes to find and delink specific groups
            delinked_count = 0
            
            # Processing in batches to avoid huge queries
            batch_size = 100
            for i in range(0, len(rejected_records), batch_size):
                batch = rejected_records[i:i+batch_size]
                
                # We match on the unique 4-part key used for grouping
                for record in batch:
                    cursor.execute("""
                        UPDATE group_matching_queue 
                        SET matched_college_id = NULL,
                            match_score = NULL,
                            match_method = 'delinked_by_guardian',
                            is_processed = 0
                        WHERE normalized_state = ?
                          AND normalized_college_name = ?
                          AND COALESCE(normalized_address, 'NO_ADDRESS') = ?
                          AND sample_course_type = ?
                    """, (
                        record.normalized_state,
                        record.normalized_college_name,
                        record.normalized_address or 'NO_ADDRESS',
                        record.course_type
                    ))
                    delinked_count += cursor.rowcount
            
            conn.commit()
            conn.close()
            
            if delinked_count > 0:
                console.print(f"\n[bold red]🔗 DELINKED: {delinked_count} groups had matched_college_id removed from queue[/bold red]")
            
            return delinked_count
            
            conn.commit()
            conn.close()
            
            if delinked_count > 0:
                console.print(f"\n[bold red]🔗 DELINKED: {delinked_count} groups had matched_college_id removed from queue[/bold red]")
            
            return delinked_count
            
        except Exception as e:
            logger.error(f"Failed to delink records: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return 0
    
    def run(self, limit: Optional[int] = None) -> PipelineResult:
        """
        Run the complete validation pipeline.
        
        Args:
            limit: Optional limit on records to process
            
        Returns:
            PipelineResult with all statistics
        """
        console.print(Panel.fit(
            "[bold magenta]🛡️ GUARDIAN VALIDATION PIPELINE[/bold magenta]\n"
            "Layer 1: Rule-based validation\n"
            "Layer 2: LLM council verification",
            border_style="magenta"
        ))
        
        # Step 1: Load ALL records and create GROUPs
        console.print("\n[bold cyan]STEP 1: Loading and grouping records[/bold cyan]")
        all_records = self.guardian.get_matched_records(limit=limit)  # All 16,278 rows
        total_raw_records = len(all_records)
        
        # GROUP by 5-part key: (normalized_college_name + normalized_address + normalized_state + course_type + master_college_id)
        groups: Dict[tuple, List[MatchRecord]] = {}
        for r in all_records:
            key = (
                (r.normalized_college_name or '').upper(),
                (r.normalized_address or r.address or '')[:50].upper(),
                (r.normalized_state or '').upper(),
                (r.course_type or 'unknown').upper(),
                r.master_college_id
            )
            if key not in groups:
                groups[key] = []
            groups[key].append(r)
        
        total_groups = len(groups)
        ratio = total_raw_records / total_groups if total_groups > 0 else 0
        console.print(f"  Loaded {total_raw_records:,} raw records → {total_groups:,} GROUPs ({ratio:.1f}x)")
        
        # Create indexed mappings to avoid duplicate ID issues
        # Use tuple(key, members) indexed by position to guarantee uniqueness
        indexed_groups = list(groups.items())  # [(key, members), ...]
        group_representatives = [members[0] for key, members in indexed_groups]
        
        # Map record_id → (group_index, member_count) for later lookup
        # Note: If rep IDs are duplicated, we use the FIRST occurrence
        record_id_to_group_idx = {}
        group_idx_to_count = {}
        group_idx_to_members = {}
        
        for idx, (key, members) in enumerate(indexed_groups):
            rep = members[0]
            group_idx_to_count[idx] = len(members)
            group_idx_to_members[idx] = members
            # Only store first occurrence of this ID (avoid overwrite)
            if rep.id not in record_id_to_group_idx:
                record_id_to_group_idx[rep.id] = idx
        
        # Debug: verify all records are accounted
        total_in_groups = sum(group_idx_to_count.values())
        if total_in_groups != total_raw_records:
            console.print(f"[yellow]⚠️ Warning: {total_raw_records - total_in_groups} records not in indexed groups[/yellow]")
        
        # Step 2: Guardian validation (on GROUP representatives)
        console.print("\n[bold cyan]STEP 2: Guardian rule validation (per GROUP)[/bold cyan]")
        guardian_results = self.guardian.validate_batch(group_representatives)
        
        # Map validation result record_id → group index for counting
        # Since we pass group_representatives in order, the FIRST occurrence of each ID maps to its index
        # For duplicates, we track ALL indices that share this ID
        results_all = guardian_results['pass'] + guardian_results['quarantine'] + guardian_results['block']
        
        # Count groups
        guardian_pass_groups = len(guardian_results['pass'])
        guardian_quarantine_groups = len(guardian_results['quarantine'])
        guardian_block_groups = len(guardian_results['block'])
        
        # Count raw records by summing member counts for each result
        # Results come back in same order as input, so we match by position
        guardian_pass = 0
        guardian_quarantine = 0
        guardian_block = 0
        
        # Build position-based lookup: find which group each result corresponds to
        rep_id_to_all_indices = {}  # rep.id → [idx1, idx2, ...]
        for idx, (key, members) in enumerate(indexed_groups):
            rep_id = members[0].id
            if rep_id not in rep_id_to_all_indices:
                rep_id_to_all_indices[rep_id] = []
            rep_id_to_all_indices[rep_id].append(idx)
        
        # Track which indices we've used for each ID (to handle duplicates)
        used_indices = {rid: 0 for rid in rep_id_to_all_indices}
        
        for v in guardian_results['pass']:
            indices = rep_id_to_all_indices.get(v.record_id, [])
            if indices:
                pos = used_indices[v.record_id]
                if pos < len(indices):
                    idx = indices[pos]
                    guardian_pass += group_idx_to_count[idx]
                    used_indices[v.record_id] += 1
                else:
                    guardian_pass += 1
            else:
                guardian_pass += 1
                
        for v in guardian_results['quarantine']:
            indices = rep_id_to_all_indices.get(v.record_id, [])
            if indices:
                pos = used_indices[v.record_id]
                if pos < len(indices):
                    idx = indices[pos]
                    guardian_quarantine += group_idx_to_count[idx]
                    used_indices[v.record_id] += 1
                else:
                    guardian_quarantine += 1
            else:
                guardian_quarantine += 1
                
        for v in guardian_results['block']:
            indices = rep_id_to_all_indices.get(v.record_id, [])
            if indices:
                pos = used_indices[v.record_id]
                if pos < len(indices):
                    idx = indices[pos]
                    guardian_block += group_idx_to_count[idx]
                    used_indices[v.record_id] += 1
                else:
                    guardian_block += 1
            else:
                guardian_block += 1
        
        pct_pass = guardian_pass / total_raw_records * 100 if total_raw_records > 0 else 0
        pct_quarantine = guardian_quarantine / total_raw_records * 100 if total_raw_records > 0 else 0
        pct_block = guardian_block / total_raw_records * 100 if total_raw_records > 0 else 0
        console.print(f"  ✅ PASS: {guardian_pass_groups:,} groups ({guardian_pass:,} records, {pct_pass:.1f}%)")
        console.print(f"  🟡 QUARANTINE: {guardian_quarantine_groups:,} groups ({guardian_quarantine:,} records, {pct_quarantine:.1f}%)")
        console.print(f"  🔴 BLOCK: {guardian_block_groups:,} groups ({guardian_block:,} records, {pct_block:.1f}%)")
        
        # CRITICAL FIX: Delink Guardian BLOCKED records from group_matching_queue!
        # UPDATED: Now delink from group_matching_queue (bulk propagate runs AFTER)
        # CRITICAL FIX: Delink Guardian BLOCKED records from group_matching_queue!
        # UPDATED: Now delink from group_matching_queue (bulk propagate runs AFTER)
        if guardian_block_groups > 0:
            console.print(f"\n[bold red]🔗 DELINKING Guardian BLOCKED groups from queue...[/bold red]")
            
            # Collect representative records from BLOCKED groups (for attribute-based delinking)
            blocked_records = []
            
            for v in guardian_results['block']:
                # Lookup the actual representative record object
                idx = record_id_to_group_idx.get(v.record_id)
                if idx is not None:
                    # Get representative (first member)
                    # We only need the rep because delink logic uses normalized attributes,
                    # which are identical for all members of the group.
                    if idx in group_idx_to_members and group_idx_to_members[idx]:
                        rep = group_idx_to_members[idx][0]
                        blocked_records.append(rep)
            
            if blocked_records:
                delinked_count = self._delink_rejected_records(blocked_records)
                console.print(f"[bold red]🔗 DELINKED {delinked_count} groups (Guardian BLOCK)[/bold red]")
            else:
                console.print(f"[bold yellow]⚠️ No group records found for delinking[/bold yellow]")
        
        
        # Step 3: LLM verification of quarantine GROUPs
        verification_results = []
        llm_approved = 0
        llm_rejected = 0
        
        if guardian_quarantine_groups > 0 and not self.skip_llm_verification and self.verifier:
            console.print("\n[bold cyan]STEP 3: LLM council verification (GROUPED)[/bold cyan]")
            console.print(f"  {guardian_quarantine_groups} quarantine groups ({guardian_quarantine} records)")
            
            # Build lookup for multi_master_options from validation results
            validation_lookup = {v.record_id: v for v in guardian_results['quarantine']}
            
            # Get quarantine groups using indexed mapping
            quarantine_groups = []
            for v in guardian_results['quarantine']:
                idx = record_id_to_group_idx.get(v.record_id)
                if idx is not None:
                    members = group_idx_to_members[idx]
                    quarantine_groups.append((members, v.record_id))
            
            # Create verification records for quarantine groups
            group_records = []
            group_id_to_members = {}  # GROUP_XXX → list of all member records
            rejected_records = []  # Collect rejected records for delinking
            
            for idx, (members, rep_id) in enumerate(quarantine_groups):
                # Use first record as representative
                rep = members[0]
                group_id = f"GROUP_{idx:03d}"
                
                # Get multi_master_options from validation result
                validation = validation_lookup.get(rep_id)
                multi_master_options = validation.multi_master_options if validation else None
                
                group_records.append(VerificationRecord(
                    record_id=group_id,
                    seat_college_name=rep.college_name,
                    seat_state=rep.normalized_state or rep.state,  # Use normalized state!
                    seat_address=rep.normalized_address or rep.address,  # Use normalized address!
                    seat_course_type=rep.course_type,
                    master_college_id=rep.master_college_id,
                    master_name=rep.master_name or '',
                    master_state=rep.master_state or '',  # Already normalized from master table
                    master_address=rep.master_address,
                    match_score=rep.match_score,
                    match_method=rep.match_method,
                    group_key=f"{len(members)} records",
                    multi_master_options=multi_master_options,
                ))
                
                group_id_to_members[group_id] = members  # Store all member records
            
            if group_records:
                # Verify groups with SUPER-PARALLEL CONSENSUS (7 parallel pipelines × 3 models × 10 groups/batch)
                # This is ~14x faster than the original sequential approach
                group_results = self.verifier.verify_with_super_parallel(
                    group_records, 
                    required_votes=3,         # Get 3 model votes, majority decides
                    groups_per_batch=10,      # 10 groups per API call
                    parallel_pipelines=7,     # 7 consensus pipelines in parallel (uses 21 of 22 keys)
                )
                
                # Apply verdicts to all member records and count raw records
                for gr in group_results:
                    members = group_id_to_members.get(gr.record_id, [])
                    member_count = len(members)
                    
                    # Create individual results for each member
                    for member in members:
                        member_result = VerificationResult(
                            record_id=member.id,
                            final_verdict=gr.final_verdict,
                            votes=gr.votes,
                            approve_count=gr.approve_count,
                            reject_count=gr.reject_count,
                            group_key=gr.record_id,
                        )
                        verification_results.append(member_result)
                        
                    # Count raw records (not just groups)
                    if gr.final_verdict == VerificationVerdict.APPROVE:
                        llm_approved += member_count
                    else:
                        llm_rejected += member_count

                    # Collect rejected records for delinking
                    # Only need ONE representative per group for attribute-based delinking
                    if gr.final_verdict == VerificationVerdict.REJECT:
                        if members:
                            rejected_records.append(members[0])
            
            # DELINK rejected records from database
            if rejected_records:
                self._delink_rejected_records(rejected_records)
                
        elif self.skip_llm_verification:
            console.print("\n[bold yellow]STEP 3: LLM verification SKIPPED[/bold yellow]")
            # Treat all quarantine as needing review
            llm_rejected = guardian_quarantine
        
        # Final summary (using raw record counts)
        final_approved = guardian_pass + llm_approved
        final_rejected = guardian_block + llm_rejected
        
        self._print_final_summary(
            total_raw_records, guardian_pass, guardian_quarantine, guardian_block,
            llm_approved, llm_rejected, final_approved, final_rejected
        )
        
        return PipelineResult(
            total_records=total_raw_records,
            guardian_pass=guardian_pass,
            guardian_quarantine=guardian_quarantine,
            guardian_block=guardian_block,
            llm_approved=llm_approved,
            llm_rejected=llm_rejected,
            final_approved=final_approved,
            final_rejected=final_rejected,
            guardian_results=guardian_results,
            verification_results=verification_results,
        )
    
    def _print_final_summary(
        self,
        total: int,
        g_pass: int,
        g_quarantine: int,
        g_block: int,
        llm_approved: int,
        llm_rejected: int,
        final_approved: int,
        final_rejected: int,
    ):
        """Print final pipeline summary."""
        console.print("\n" + "=" * 60)
        console.print(Panel.fit(
            "[bold green]✅ PIPELINE COMPLETE[/bold green]",
            border_style="green"
        ))
        
        # Final results table
        table = Table(title="📊 Final Validation Results", show_header=True, header_style="bold green")
        table.add_column("Stage", style="cyan", width=30)
        table.add_column("Count", justify="right", width=15)
        table.add_column("Percentage", justify="right", width=15)
        
        table.add_row("[bold]Guardian Layer[/bold]", "", "")
        table.add_row("  ✅ Rules PASS", f"{g_pass:,}", f"{g_pass/total*100:.1f}%" if total > 0 else "N/A")
        table.add_row("  🟡 Quarantine → LLM", f"{g_quarantine:,}", f"{g_quarantine/total*100:.1f}%" if total > 0 else "N/A")
        table.add_row("  🔴 Rules BLOCK", f"{g_block:,}", f"{g_block/total*100:.1f}%" if total > 0 else "N/A")
        
        table.add_row("", "", "")
        table.add_row("[bold]LLM Council[/bold]", "", "")
        table.add_row("  ✅ LLM APPROVED", f"{llm_approved:,}", f"{llm_approved/g_quarantine*100:.1f}%" if g_quarantine > 0 else "N/A")
        table.add_row("  ❌ LLM REJECTED", f"{llm_rejected:,}", f"{llm_rejected/g_quarantine*100:.1f}%" if g_quarantine > 0 else "N/A")
        
        table.add_row("━" * 25, "━" * 10, "━" * 10)
        table.add_row("[bold green]FINAL APPROVED[/bold green]", f"[bold green]{final_approved:,}[/bold green]", f"[bold green]{final_approved/total*100:.1f}%[/bold green]" if total > 0 else "N/A")
        table.add_row("[bold red]FINAL REJECTED[/bold red]", f"[bold red]{final_rejected:,}[/bold red]", f"[bold red]{final_rejected/total*100:.1f}%[/bold red]" if total > 0 else "N/A")
        
        console.print(table)
        
        # Accuracy indicator
        accuracy = final_approved / total * 100 if total > 0 else 0
        if accuracy >= 95:
            console.print(f"\n[bold green]🎯 Validation accuracy: {accuracy:.1f}% - EXCELLENT[/bold green]")
        elif accuracy >= 90:
            console.print(f"\n[bold yellow]⚠️ Validation accuracy: {accuracy:.1f}% - REVIEW REJECTED RECORDS[/bold yellow]")
        else:
            console.print(f"\n[bold red]❌ Validation accuracy: {accuracy:.1f}% - SIGNIFICANT ISSUES DETECTED[/bold red]")


def run_pipeline(
    limit: Optional[int] = None,
    skip_llm: bool = False,
    api_keys: Optional[List[str]] = None,
) -> PipelineResult:
    """
    Convenience function to run the complete pipeline.
    
    Args:
        limit: Optional record limit
        skip_llm: Skip LLM verification (Guardian rules only)
        api_keys: Optional API keys for OpenRouter
        
    Returns:
        PipelineResult
    """
    pipeline = GuardianPipeline(
        skip_llm_verification=skip_llm,
        api_keys=api_keys,
    )
    return pipeline.run(limit=limit)


if __name__ == "__main__":
    import sys
    import yaml
    
    # Parse args
    limit = None
    skip_llm = "--skip-llm" in sys.argv
    
    for arg in sys.argv[1:]:
        if arg.isdigit():
            limit = int(arg)
    
    # Check for API keys in config.yaml
    api_keys = []
    try:
        with open('config.yaml') as f:
            config = yaml.safe_load(f)
            api_keys = config.get('agentic_matcher', {}).get('api_keys', [])
    except:
        pass
    
    if not api_keys and not skip_llm:
        import os
        if not os.getenv("OPENROUTER_API_KEY"):
            console.print("[yellow]⚠️ No API keys found in config.yaml or OPENROUTER_API_KEY env[/yellow]")
            skip_llm = True
    
    if skip_llm:
        console.print("[yellow]⚠️ LLM verification disabled (--skip-llm flag)[/yellow]")
    else:
        console.print(f"[green]✅ Found {len(api_keys)} API keys in config.yaml[/green]")
    
    result = run_pipeline(limit=limit, skip_llm=skip_llm, api_keys=api_keys if api_keys else None)
    
    print(f"\n📊 Summary:")
    print(f"  Final Approved: {result.final_approved:,} / {result.total_records:,}")
    print(f"  Final Rejected: {result.final_rejected:,}")
