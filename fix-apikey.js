const fs = require('fs');
const path = 'd:/ImageTool/components/ApiKeyModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace corrupted section
const oldPattern = /\s*<\/div \>\s*\n\s*\{\/\* Credits Purchase Modal[^}]*\} \}\s*\n\s*\{\s*\n\s*isPurchaseModalOpen && currentUserId && \(\s*\n\s*<CreditsPurchaseModal[\s\S]*?<\/>\s*\n\s*\);/;

const newContent = `
        </div>

        {/* Credits Purchase Modal - Outside backdrop to prevent event bubbling */}
        {isPurchaseModalOpen && currentUserId && (
            <CreditsPurchaseModal
                userId={currentUserId}
                userName={currentUserName}
                userEmail={currentUserEmail}
                currentCredits={userCredits}
                onClose={() => setPurchaseModalOpen(false)}
                onSuccess={(newBalance) => {
                    setUserCredits(newBalance);
                    setPurchaseModalOpen(false);
                    if (newBalance > 0) {
                        setIsPro(true);
                    }
                }}
            />
        )}
    </>
    );`;

content = content.replace(oldPattern, newContent);
fs.writeFileSync(path, content);
console.log('Fixed!');
