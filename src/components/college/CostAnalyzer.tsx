/**
 * CostAnalyzer Component
 *
 * Complete cost breakdown including:
 * - Tuition fees per year
 * - Hostel and accommodation costs
 * - Hidden fees (library, exam, lab, etc.)
 * - 5-year total projection
 * - Scholarship opportunities
 * - EMI calculator for education loans
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  Home,
  Book,
  TrendingUp,
  Award,
  Calculator,
  Download,
  PieChart,
  Info
} from 'lucide-react';
import type { College } from './CollegeWorkspace';

interface CostBreakdown {
  tuitionFee: number;
  hostelFee: number;
  examFee: number;
  libraryFee: number;
  labFee: number;
  sportsFee: number;
  developmentFee: number;
  otherFees: number;
}

interface LoanDetails {
  principal: number;
  interestRate: number;
  tenure: number;
}

export default function CostAnalyzer({ college }: { college: College }) {
  const [selectedDuration, setSelectedDuration] = useState<'annual' | '5year'>('annual');
  const [loanAmount, setLoanAmount] = useState(500000);
  const [interestRate, setInterestRate] = useState(8.5);
  const [tenure, setTenure] = useState(10);

  // Mock cost data - In production, fetch from API
  const costBreakdown: CostBreakdown = {
    tuitionFee: college.management_type === 'Government' ? 35000 : 250000,
    hostelFee: 20000,
    examFee: 5000,
    libraryFee: 3000,
    labFee: 15000,
    sportsFee: 2000,
    developmentFee: 10000,
    otherFees: 10000
  };

  const annualTotal = Object.values(costBreakdown).reduce((sum, val) => sum + val, 0);
  const fiveYearTotal = annualTotal * 5.5; // Including internship year

  const calculateEMI = (principal: number, rate: number, years: number) => {
    const monthlyRate = rate / (12 * 100);
    const months = years * 12;
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
                 (Math.pow(1 + monthlyRate, months) - 1);
    return Math.round(emi);
  };

  const emi = calculateEMI(loanAmount, interestRate, tenure);
  const totalPayment = emi * tenure * 12;
  const totalInterest = totalPayment - loanAmount;

  return (
    <div className="space-y-6">
      {/* Duration Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
          <DollarSign className="w-6 h-6 mr-2" />
          Cost Analysis
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setSelectedDuration('annual')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              selectedDuration === 'annual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            Annual
          </button>
          <button
            onClick={() => setSelectedDuration('5year')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              selectedDuration === '5year'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            5.5 Year Total
          </button>
        </div>
      </div>

      {/* Total Cost Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`bg-gradient-to-br ${
          college.management_type === 'Government'
            ? 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800'
            : 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800'
        } rounded-2xl p-8 border-2`}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
              {selectedDuration === 'annual' ? 'Annual Cost' : '5.5 Year Total Cost'}
            </p>
            <p className="text-5xl font-bold text-gray-900 dark:text-white">
              ₹{(selectedDuration === 'annual' ? annualTotal : fiveYearTotal).toLocaleString('en-IN')}
            </p>
          </div>
          <div className={`p-4 rounded-2xl ${
            college.management_type === 'Government'
              ? 'bg-green-500'
              : 'bg-blue-500'
          }`}>
            <DollarSign className="w-12 h-12 text-white" />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            college.management_type === 'Government'
              ? 'bg-green-200 dark:bg-green-900/40 text-green-800 dark:text-green-300'
              : 'bg-blue-200 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'
          }`}>
            {college.management_type}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {college.management_type === 'Government' ? 'Very Affordable' : 'Premium Investment'}
          </span>
        </div>
      </motion.div>

      {/* Cost Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
            <PieChart className="w-5 h-5 mr-2" />
            Detailed Breakdown (Per Year)
          </h4>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {Object.entries(costBreakdown).map(([key, value], index) => {
            const percentage = (value / annualTotal) * 100;
            const label = key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase());

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">{label}</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    ₹{value.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-gray-900 dark:text-white">Total Annual Cost</span>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              ₹{annualTotal.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Additional Expenses */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <Info className="w-5 h-5 mr-2 text-yellow-600" />
          Additional Expenses to Consider
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-700 dark:text-gray-300">Food & Mess</span>
              <span className="font-medium text-gray-900 dark:text-white">₹2,500/month</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700 dark:text-gray-300">Books & Stationery</span>
              <span className="font-medium text-gray-900 dark:text-white">₹15,000/year</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700 dark:text-gray-300">Transport</span>
              <span className="font-medium text-gray-900 dark:text-white">₹5,000/year</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-700 dark:text-gray-300">Medical Insurance</span>
              <span className="font-medium text-gray-900 dark:text-white">₹3,000/year</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700 dark:text-gray-300">Miscellaneous</span>
              <span className="font-medium text-gray-900 dark:text-white">₹10,000/year</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700 dark:text-gray-300">Laptop/Equipment</span>
              <span className="font-medium text-gray-900 dark:text-white">₹50,000 (one-time)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scholarships */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <Award className="w-5 h-5 mr-2 text-purple-600" />
          Available Scholarships
        </h4>
        <div className="space-y-4">
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900 dark:text-white">Merit Scholarship</span>
              <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-sm font-medium">
                Up to 100%
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              For students with NEET rank below 1000. Covers full tuition fees.
            </p>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900 dark:text-white">Financial Aid</span>
              <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-medium">
                Up to 50%
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Need-based scholarship for students from economically weaker sections.
            </p>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900 dark:text-white">State Scholarship</span>
              <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-medium">
                ₹50,000/year
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              State government scholarship for domicile students.
            </p>
          </div>
        </div>
      </div>

      {/* EMI Calculator */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <Calculator className="w-5 h-5 mr-2 text-blue-600" />
          Education Loan EMI Calculator
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Loan Amount (₹)
            </label>
            <input
              type="number"
              value={loanAmount}
              onChange={(e) => setLoanAmount(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              step="10000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Interest Rate (% p.a.)
            </label>
            <input
              type="number"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              step="0.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tenure (years)
            </label>
            <input
              type="number"
              value={tenure}
              onChange={(e) => setTenure(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              step="1"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Monthly EMI</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              ₹{emi.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Payment</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ₹{totalPayment.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Interest</div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              ₹{totalInterest.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* Download Report Button */}
      <button className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center space-x-2">
        <Download className="w-5 h-5" />
        <span>Download Complete Cost Report (PDF)</span>
      </button>
    </div>
  );
}
