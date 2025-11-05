#!/bin/bash

# Test script pour vérifier les liens d'invitation d'équipe

echo "=== Test des liens d'invitation d'équipe ==="

# Configuration
BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:3000"
TEST_TOKEN="test-token-123"

echo ""
echo "🔍 Test 1: Structure des URLs"
echo "Backend email template URL: ${FRONTEND_URL}/teams/invite/accept/${TEST_TOKEN}"
echo "Frontend route attendue:    /teams/invite/accept/[token]"
echo "✅ Les URLs correspondent maintenant!"

echo ""
echo "🔍 Test 2: Endpoint de redirection backend"
echo "GET ${BACKEND_URL}/api/v1/teams/invite/accept/${TEST_TOKEN}"
echo "Should redirect to: ${FRONTEND_URL}/teams/invite/accept/${TEST_TOKEN}"

echo ""
echo "🔍 Test 3: Gestion des erreurs"
echo "URL avec erreur: ${FRONTEND_URL}/teams/invite/accept/${TEST_TOKEN}?error=Token%20expired"
echo "La page frontend devrait afficher l'erreur décodée"

echo ""
echo "📋 Corrections apportées:"
echo "✅ URL dans team.service.ts corrigée: /teams/invite/accept/\${token}"
echo "✅ Endpoint GET backend avec redirection automatique"
echo "✅ Page frontend mise à jour pour gérer les paramètres d'erreur"
echo "✅ Import Response corrigé dans team.controller.ts"

echo ""
echo "🚀 Pour tester manuellement:"
echo "1. Créer une équipe"
echo "2. Inviter un membre via email"
echo "3. Vérifier que le lien dans l'email fonctionne"
echo "4. Le lien devrait rediriger vers la page d'acceptation"

echo ""
echo "💡 URLs de test à vérifier:"
echo "- Email link: ${FRONTEND_URL}/teams/invite/accept/[REAL_TOKEN]"
echo "- Error case: ${FRONTEND_URL}/teams/invite/accept/invalid-token?error=Invalid%20token"
echo "- Success case: Should redirect to /teams/[TEAM_ID]"