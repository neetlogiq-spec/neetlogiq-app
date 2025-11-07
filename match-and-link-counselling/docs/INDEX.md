# Counselling Data Matching System - Documentation Index

## 📚 Documentation Structure

This documentation suite provides complete coverage of the Counselling Data Matching and Linking System.

### 🎯 Quick Links

| Document | Purpose | Audience |
|----------|---------|----------|
| **[README.md](README.md)** | System overview & quick start | Everyone |
| **[USAGE_GUIDE.md](USAGE_GUIDE.md)** | Detailed usage instructions | Users & Operators |
| **[ALGORITHM_DETAILS.md](ALGORITHM_DETAILS.md)** | Technical deep dive | Developers |
| **[API_REFERENCE.md](API_REFERENCE.md)** | Complete API documentation | Developers |

---

## 📖 Document Descriptions

### 1. README.md
**Comprehensive System Overview**

- System architecture and features
- Quick start guide
- Configuration reference
- Database schema
- Performance metrics
- Troubleshooting basics

**Start here if you're**: New to the system, setting up for the first time, or need a quick reference.

---

### 2. USAGE_GUIDE.md
**Step-by-Step Usage Instructions**

- Installation and setup
- Basic and advanced workflows
- Interactive review tutorial
- Alias management
- Batch processing
- Detailed troubleshooting
- Monitoring and reporting

**Start here if you're**: Running the system, processing data, or managing day-to-day operations.

---

### 3. ALGORITHM_DETAILS.md
**Technical Deep Dive**

- 4-pass matching algorithm explained
- DIPLOMA fallback logic
- Course classification system
- State normalization strategy
- Fuzzy matching implementation
- Performance optimization techniques
- Data flow diagrams

**Start here if you're**: Understanding the algorithms, modifying matching logic, or optimizing performance.

---

### 4. API_REFERENCE.md
**Complete API Documentation**

- Class and method references
- Function signatures
- Parameters and return values
- Usage examples
- Error handling
- Best practices

**Start here if you're**: Integrating with the system, writing scripts, or extending functionality.

---

## 🗂️ File Organization

```
match-and-link-counselling/
├── match_and_link_counselling_data.py  # Main script (3328 lines)
├── scripts/
│   └── create_state_mapping.py         # State normalization (300 lines)
├── config/
│   └── config.yaml                     # Configuration file
├── docs/
│   ├── INDEX.md                        # This file
│   ├── README.md                       # System overview
│   ├── USAGE_GUIDE.md                  # Usage instructions
│   ├── ALGORITHM_DETAILS.md            # Technical details
│   └── API_REFERENCE.md                # API documentation
└── logs/
    └── counselling_matching.log        # Execution logs
```

---

## 🎓 Learning Path

### For New Users

1. **Start**: [README.md](README.md) - System Overview
   - Understand what the system does
   - See key features
   - Review match rate statistics

2. **Setup**: [USAGE_GUIDE.md](USAGE_GUIDE.md) - Installation
   - Install dependencies
   - Set up directories
   - Configure settings

3. **First Run**: [USAGE_GUIDE.md](USAGE_GUIDE.md) - Basic Workflow
   - Import data
   - Run matching
   - Review results

4. **Improve**: [USAGE_GUIDE.md](USAGE_GUIDE.md) - Interactive Review
   - Understand failure reasons
   - Create aliases
   - Monitor improvement

### For Developers

1. **Architecture**: [README.md](README.md) - System Architecture
   - Understand components
   - Review database schema
   - See data flow

2. **Algorithms**: [ALGORITHM_DETAILS.md](ALGORITHM_DETAILS.md)
   - Deep dive into matching logic
   - Understand optimization
   - Learn edge cases

3. **API**: [API_REFERENCE.md](API_REFERENCE.md)
   - Class and method reference
   - Integration patterns
   - Extension points

4. **Customize**: [ALGORITHM_DETAILS.md](ALGORITHM_DETAILS.md) - Modification
   - Adjust thresholds
   - Add new patterns
   - Optimize performance

### For Operators

1. **Daily Operations**: [USAGE_GUIDE.md](USAGE_GUIDE.md)
   - Run batch processing
   - Monitor match rates
   - Generate reports

2. **Troubleshooting**: [USAGE_GUIDE.md](USAGE_GUIDE.md) - Troubleshooting
   - Solve common issues
   - Optimize performance
   - Handle errors

3. **Maintenance**: [README.md](README.md) - Database Schema
   - Backup procedures
   - Index maintenance
   - Cleanup old data

---

## 🔍 Quick Reference

### Common Tasks

| Task | Document | Section |
|------|----------|---------|
| Install system | USAGE_GUIDE.md | Getting Started |
| First time setup | USAGE_GUIDE.md | Basic Workflow |
| Process new data | USAGE_GUIDE.md | Step 1-4 |
| Review unmatched | USAGE_GUIDE.md | Interactive Review |
| Create aliases | USAGE_GUIDE.md | Alias Management |
| Batch process | USAGE_GUIDE.md | Batch Processing |
| Understand algorithms | ALGORITHM_DETAILS.md | All sections |
| API integration | API_REFERENCE.md | All sections |
| Troubleshoot issues | USAGE_GUIDE.md | Troubleshooting |
| Configure system | README.md | Configuration |

### Key Concepts

| Concept | Explained In | Page |
|---------|--------------|------|
| 4-Pass Matching | ALGORITHM_DETAILS.md | Pass 1-4 |
| DIPLOMA Fallback | ALGORITHM_DETAILS.md | DIPLOMA Logic |
| State Normalization | ALGORITHM_DETAILS.md | State Mapping |
| Course Classification | ALGORITHM_DETAILS.md | Course Types |
| Interactive Review | USAGE_GUIDE.md | Interactive Review |
| Alias System | USAGE_GUIDE.md | Alias Management |
| Parallel Processing | USAGE_GUIDE.md | Advanced Usage |
| Database Schema | README.md | Database Schema |

---

## 💡 Tips for Using Documentation

### Search Tips

- Use Ctrl+F (Cmd+F) to search within documents
- Look for emoji markers (🎯, 📊, 🔍) to find sections quickly
- Check the table of contents at the start of each document

### Code Examples

- All documents include code examples
- Copy-paste ready snippets
- Real-world usage patterns

### Updates

- Documentation is versioned with the code
- Last updated: October 2025
- Check git history for changes

---

## 🤝 Contributing to Documentation

### Reporting Issues

If you find errors or unclear sections:
1. Note the document name and section
2. Describe the issue
3. Suggest improvements
4. Contact the data team

### Suggesting Improvements

- New examples
- Better explanations
- Additional use cases
- Missing information

---

## 📞 Getting Help

### Self-Help Resources

1. **Search this documentation** - Most answers are here
2. **Check logs** - `logs/counselling_matching.log`
3. **Run with verbose mode** - For detailed output
4. **Review examples** - USAGE_GUIDE.md has many examples

### Support Channels

1. **Documentation** - You're reading it!
2. **Code comments** - In-line explanations
3. **Log files** - Detailed execution logs
4. **Data team** - For complex issues

---

## 📊 Documentation Statistics

- **Total Documents**: 5 (including this index)
- **Total Pages**: ~100 equivalent pages
- **Code Examples**: 50+
- **Diagrams**: 10+
- **API Methods Documented**: 50+
- **Configuration Options**: 30+

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0 | Oct 2025 | Complete rewrite with interactive features |
| 2.5 | Sep 2025 | Added DIPLOMA fallback logic |
| 2.0 | Aug 2025 | Added state normalization |
| 1.5 | Jul 2025 | Added course classification |
| 1.0 | Jun 2025 | Initial version |

---

## 🎯 Next Steps

Choose your path:

- **📖 Learn**: Start with [README.md](README.md)
- **🚀 Use**: Go to [USAGE_GUIDE.md](USAGE_GUIDE.md)
- **🔧 Develop**: Read [ALGORITHM_DETAILS.md](ALGORITHM_DETAILS.md)
- **💻 Code**: See [API_REFERENCE.md](API_REFERENCE.md)

---

**Happy Matching! 🎉**

*This documentation is maintained by the Data Engineering Team*
