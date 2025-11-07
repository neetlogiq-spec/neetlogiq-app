'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Users, Target, GraduationCap, Star, Shield, Zap, Phone, Mail, MapPin } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Vortex } from '@/components/ui/vortex';
import { LightVortex } from '@/components/ui/light-vortex';

const AboutUsPage: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  const teamMembers = [
    {
      name: 'Dr. Anonymous',
      role: 'Founder & Creator',
      expertise: 'Clinical Medicine & Medical Education Technology',
      experience: '2+ Years in Medical Practice & 4+ Years in Research',
      image: '/images/team/doctor.jpg',
      description: 'A dedicated physician and medical education innovator who founded NeetLogIQ to bridge the gap between medical aspirants and comprehensive career guidance. Combining clinical experience with research expertise, Dr. Anonymous created this platform to provide data-driven insights and personalized recommendations for students pursuing medical careers.'
    }
  ];

  const stats = [
    { number: '2,400+', label: 'Colleges Covered', icon: GraduationCap },
    { number: '28', label: 'States Covered', icon: MapPin },
    { number: 'Growing', label: 'Database', icon: Shield },
    { number: '24/7', label: 'Support Available', icon: Shield }
  ];

  const values = [
    {
      title: 'Excellence',
      description: 'We strive for excellence in everything we do, from data accuracy to user experience.',
      icon: Star,
      color: 'text-yellow-400'
    },
    {
      title: 'Innovation',
      description: 'Continuously innovating with AI-powered recommendations and cutting-edge technology.',
      icon: Zap,
      color: 'text-blue-400'
    },
    {
      title: 'Integrity',
      description: 'Maintaining the highest standards of integrity and transparency in all our services.',
      icon: Shield,
      color: 'text-green-400'
    },
    {
      title: 'Empowerment',
      description: 'Empowering students with knowledge and tools to make informed decisions.',
      icon: Target,
      color: 'text-purple-400'
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen relative overflow-hidden">
        {/* Dynamic Background */}
        <div className="absolute inset-0 z-0">
          <LightVortex
            className="fixed inset-0 z-0"
            particleCount={350}
            baseHue={240}
            baseSpeed={0.12}
            rangeSpeed={1.6}
            baseRadius={1}
            rangeRadius={2.4}
            backgroundColor="#ffffff"
            containerClassName="fixed inset-0"
          >
            <div className="absolute inset-0 bg-white/20 z-10"></div>
          </LightVortex>
        </div>

        {/* Content */}
        <div className="relative z-20 min-h-screen">
          <div className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                transition={{ duration: 0.8 }}
                className="text-center mb-16"
              >
                <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              About NeetLogIQ
            </h1>
                <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed">
                  Empowering medical aspirants with comprehensive data, intelligent insights, and personalized guidance for their journey to medical excellence.
            </p>
              </motion.div>

        {/* Mission Section */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="mb-16"
              >
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 md:p-12">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Heart className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Our Mission
              </h2>
                  </div>
                  <div className="max-w-4xl mx-auto text-center">
                    <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                      To democratize access to medical education information and provide every aspiring medical student with the tools, data, and insights they need to make informed decisions about their future. We believe that every student deserves access to comprehensive, accurate, and up-to-date information about medical colleges, courses, and admission processes.
                    </p>
                    <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                      Our platform combines cutting-edge technology with deep domain expertise to create a one-stop solution for all medical education needs, making the complex world of medical admissions more accessible and transparent.
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Stats Section */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="mb-16"
              >
                <div className="text-center mb-12">
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                    Our Impact
                  </h2>
                  <p className="text-xl text-gray-600 dark:text-gray-300">
                    Numbers that speak to our commitment and reach
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                        transition={{ duration: 0.6, delay: 0.6 + index * 0.1 }}
                        className="text-center"
                      >
                        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Icon className="h-8 w-8 text-white" />
                        </div>
                        <div className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                          {stat.number}
              </div>
                        <div className="text-sm md:text-base text-gray-600 dark:text-gray-300">
                          {stat.label}
            </div>
                      </motion.div>
                    );
                  })}
          </div>
              </motion.div>

        {/* Values Section */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="mb-16"
              >
            <div className="text-center mb-12">
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Our Values
              </h2>
                  <p className="text-xl text-gray-600 dark:text-gray-300">
                    The principles that guide everything we do
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {values.map((value, index) => {
                    const Icon = value.icon;
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                        transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
                        className="text-center"
                      >
                        <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                          <Icon className={`h-8 w-8 ${value.color}`} />
                  </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                    {value.title}
                  </h3>
                        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                    {value.description}
                  </p>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>

        {/* Team Section */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="mb-16"
              >
            <div className="text-center mb-12">
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                    Our Team
              </h2>
                  <p className="text-xl text-gray-600 dark:text-gray-300">
                    The passionate individuals behind NeetLogIQ
              </p>
            </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {teamMembers.map((member, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                      transition={{ duration: 0.6, delay: 1.0 + index * 0.1 }}
                      className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center"
                    >
                      <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Users className="h-12 w-12 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {member.name}
                  </h3>
                      <p className="text-lg text-blue-600 dark:text-blue-400 mb-4">
                    {member.role}
                  </p>
                      <div className="space-y-2 mb-6">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <strong>Expertise:</strong> {member.expertise}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <strong>Experience:</strong> {member.experience}
                        </p>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                    {member.description}
                  </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

        {/* Contact Section */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                transition={{ duration: 0.8, delay: 1.0 }}
                className="mb-16"
              >
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 md:p-12">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Get in Touch
            </h2>
                    <p className="text-xl text-gray-600 dark:text-gray-300">
                      We'd love to hear from you
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Mail className="h-6 w-6 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Email
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        info@neetlogiq.com
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Phone className="h-6 w-6 text-green-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Phone
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        +91-9876543210
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MapPin className="h-6 w-6 text-purple-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Location
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300">
                        India
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AboutUsPage;