-- Crée la base utilisée par les tests de bout en bout
CREATE DATABASE livraison_test OWNER livraison;
\c livraison_test
CREATE EXTENSION IF NOT EXISTS postgis;
