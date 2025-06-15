import { BaseGame } from './baseGame.js';
import { Logger } from '../../utils/workerLogger.js';

const logger = new Logger('BigEaterCompetition');

export class BigEaterCompetitionGame extends BaseGame {
    constructor(config) {
        super(config);
        this.maxRounds = 10;
        this.foods = this.initializeFoods();
        this.powerUps = this.initializePowerUps();
        this.sabotageActions = this.initializeSabotage();
    }

    async initialize() {
        await super.initialize();
        
        this.gameState = {
            round: 1,
            maxRounds: this.maxRounds,
            gamePhase: 'preparation', // preparation, eating, results, ended
            currentFood: null,
            timeRemaining: 30,
            
            // Player stats
            players: this.players.map(player => ({
                userId: player.user_id,
                name: player.first_name || player.username,
                totalBites: 0,
                currentRoundBites: 0,
                energy: 100,
                digestion: 100,
                mood: 'excited', // excited, focused, tired, stuffed
                powerUps: [],
                achievements: [],
                relationshipPoints: 0, // Special couple points!
                specialMoves: 3 // Can use special romantic moves
            })),
            
            // Game events
            events: [],
            story: [],
            winner: null,
            
            // Romance elements
            coupleBonus: 0,
            romanticMoments: [],
            competitiveSpirit: 50 // Balance between competition and romance
        };

        // Start with preparation phase
        await this.startPreparationPhase();
        await this.saveGameState();
        logger.info(`Big Eater Competition ${this.sessionId} initialized for couple play`);
    }

    initializeFoods() {
        return [
            // Casual Foods
            { name: '🍕 Pizza Slices', difficulty: 1, bites: 4, description: 'Classic cheesy goodness' },
            { name: '🍔 Burgers', difficulty: 2, bites: 6, description: 'Juicy and filling' },
            { name: '🌭 Hot Dogs', difficulty: 1, bites: 3, description: 'Quick and easy' },
            { name: '🍝 Spaghetti', difficulty: 3, bites: 8, description: 'Messy but delicious' },
            
            // Romantic Foods
            { name: '🍰 Chocolate Cake', difficulty: 2, bites: 5, description: 'Sweet like your love' },
            { name: '🍓 Strawberries & Cream', difficulty: 1, bites: 3, description: 'Feed each other?' },
            { name: '🥂 Champagne & Caviar', difficulty: 4, bites: 7, description: 'Fancy date night vibes' },
            { name: '💕 Heart-shaped Cookies', difficulty: 1, bites: 2, description: 'Made with love' },
            
            // Challenge Foods
            { name: '🌶️ Spicy Wings', difficulty: 4, bites: 10, description: 'Test your heat tolerance!' },
            { name: '🥩 Giant Steak', difficulty: 5, bites: 12, description: 'The ultimate challenge' },
            { name: '🍜 Ramen Bowl', difficulty: 3, bites: 9, description: 'Slurp competition!' },
            { name: '🌮 Taco Platter', difficulty: 3, bites: 8, description: 'Don\'t drop the filling!' },
            
            // Fun Foods
            { name: '🍩 Donuts', difficulty: 2, bites: 4, description: 'Sweet and sugary' },
            { name: '🧀 Cheese Wheel', difficulty: 4, bites: 15, description: 'For true cheese lovers' },
            { name: '🍦 Ice Cream Sundae', difficulty: 2, bites: 6, description: 'Brain freeze risk!' },
            { name: '🥨 Giant Pretzel', difficulty: 3, bites: 7, description: 'Twist and shout!' }
        ];
    }

    initializePowerUps() {
        return [
            // Individual Power-ups
            { name: '⚡ Speed Boost', effect: 'extra_bite', description: 'Take an extra bite this round!' },
            { name: '💪 Power Jaw', effect: 'double_damage', description: 'Double bite power for 3 rounds' },
            { name: '🥤 Energy Drink', effect: 'restore_energy', description: 'Restore 50 energy points' },
            { name: '💊 Digestive Aid', effect: 'digestion_boost', description: 'Boost digestion by 30%' },
            
            // Romantic Power-ups
            { name: '💋 Love Boost', effect: 'couple_bonus', description: 'Both players get +2 bites when used together!' },
            { name: '🥰 Motivation Kiss', effect: 'partner_heal', description: 'Restore your partner\'s energy' },
            { name: '💑 Team Spirit', effect: 'shared_power', description: 'Share your power-ups with partner' },
            { name: '😍 Romantic Gaze', effect: 'inspire_partner', description: 'Give partner confidence boost' }
        ];
    }

    initializeSabotage() {
        return [
            // Playful Sabotage
            { name: '😘 Distraction Kiss', effect: 'distract', description: 'Make partner lose focus (but gain love points!)' },
            { name: '🤗 Tickle Attack', effect: 'tickle', description: 'Partner loses a bite but laughs' },
            { name: '📸 Photo Moment', effect: 'pause', description: 'Stop for a cute eating selfie' },
            { name: '💬 Sweet Talk', effect: 'charm', description: 'Convince partner to slow down with compliments' },
            
            // Food Tricks
            { name: '🍯 Honey Trap', effect: 'sticky_fingers', description: 'Make eating messier for partner' },
            { name: '🌶️ Spice Surprise', effect: 'spicy_shock', description: 'Add extra spice to partner\'s food' },
            { name: '🧊 Ice Cube', effect: 'brain_freeze', description: 'Cold surprise for partner' },
            { name: '🎭 Fake Full', effect: 'fake_surrender', description: 'Pretend to give up, then surprise comeback!' }
        ];
    }

    async startPreparationPhase() {
        this.gameState.gamePhase = 'preparation';
        this.gameState.currentFood = this.selectRandomFood();
        
        const storyText = this.generateRoundStory();
        this.gameState.story.push(storyText);
        
        this.gameState.events.push({
            type: 'phase_start',
            phase: 'preparation',
            message: `🍽️ Round ${this.gameState.round}: ${this.gameState.currentFood.name} Challenge!`,
            timestamp: new Date()
        });
    }

    generateRoundStory() {
        const stories = [
            `💕 You and your girlfriend sit across from each other, eyes sparkling with competitive spirit. The ${this.gameState.currentFood.name} sits between you, waiting to be conquered!`,
            
            `😏 "Think you can out-eat me?" your girlfriend challenges with a playful smirk. The ${this.gameState.currentFood.name} looks delicious and daunting.`,
            
            `🥰 Your girlfriend stretches across the table to give you a good luck kiss before the ${this.gameState.currentFood.name} battle begins. "May the best eater win, babe!"`,
            
            `😤 The competitive fire burns in both your eyes as you stare down the ${this.gameState.currentFood.name}. "This is for the crown of our relationship!" she declares dramatically.`,
            
            `💑 Hand in hand, you both take a moment to appreciate this silly but fun moment together before diving into the ${this.gameState.currentFood.name} challenge.`
        ];
        
        return stories[Math.floor(Math.random() * stories.length)];
    }

    selectRandomFood() {
        const availableFoods = this.foods.filter(food => 
            food.difficulty <= Math.min(this.gameState.round + 1, 5)
        );
        return availableFoods[Math.floor(Math.random() * availableFoods.length)];
    }

    async processMove(userId, moveData) {
        try {
            const player = this.getPlayerByUserId(userId);
            const playerState = this.gameState.players.find(p => p.userId === userId);
            const partner = this.gameState.players.find(p => p.userId !== userId);
            
            if (!player || !playerState) {
                throw new Error('Player not found in this game');
            }

            const { action, target } = moveData;
            let result = { success: true, events: [] };

            switch (action) {
                case 'bite':
                    result = await this.processBite(playerState, partner);
                    break;
                    
                case 'power_up':
                    result = await this.usePowerUp(playerState, partner, target);
                    break;
                    
                case 'sabotage':
                    result = await this.useSabotage(playerState, partner, target);
                    break;
                    
                case 'romantic_move':
                    result = await this.useRomanticMove(playerState, partner, target);
                    break;
                    
                case 'ready':
                    result = await this.markPlayerReady(playerState);
                    break;
                    
                default:
                    throw new Error('Invalid action');
            }

            // Record the move
            await this.recordMove(userId, {
                action,
                target,
                result: result.summary,
                gameState: { round: this.gameState.round, phase: this.gameState.gamePhase }
            });

            // Check if round/game should end
            const gameEndCheck = this.checkGameEnd();
            if (gameEndCheck.ended) {
                result.gameEnded = true;
                result.winner = gameEndCheck.winner;
                result.endReason = gameEndCheck.reason;
                result.finalState = this.gameState;
            } else {
                // Check if round should advance
                await this.checkRoundAdvancement();
            }

            await this.saveGameState();
            return result;

        } catch (error) {
            logger.error(`Move processing error in game ${this.sessionId}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async processBite(playerState, partner) {
        if (this.gameState.gamePhase !== 'eating') {
            return { success: false, error: 'Not in eating phase!' };
        }

        if (playerState.energy < 10) {
            return { success: false, error: 'Too tired to eat! Use a power-up or rest.' };
        }

        // Calculate bite success
        const biteSuccess = this.calculateBiteSuccess(playerState);
        
        if (biteSuccess) {
            playerState.currentRoundBites++;
            playerState.totalBites++;
            playerState.energy -= 8;
            playerState.digestion -= 5;
            
            const messages = [
                `🍴 *CHOMP!* You take a big bite of ${this.gameState.currentFood.name}!`,
                `😋 Delicious! You devour another piece like a champion!`,
                `💪 Your jaw muscles flex as you dominate that ${this.gameState.currentFood.name}!`,
                `🏆 That's the eating technique of a true competitor!`
            ];
            
            const message = messages[Math.floor(Math.random() * messages.length)];
            
            // Check if partner reacts
            const partnerReaction = this.generatePartnerReaction(partner, 'impressed');
            
            return {
                success: true,
                message: message,
                partnerReaction: partnerReaction,
                events: [`${playerState.name} takes a successful bite! (${playerState.currentRoundBites} total this round)`]
            };
        } else {
            playerState.energy -= 3;
            
            const failMessages = [
                `😅 Oops! You bit off more than you could chew!`,
                `🤢 That bite was too ambitious! Take it easier.`,
                `😵 You pause to catch your breath - that was a tough one!`,
                `💔 The food fights back! Better luck next bite.`
            ];
            
            const message = failMessages[Math.floor(Math.random() * failMessages.length)];
            const partnerReaction = this.generatePartnerReaction(partner, 'encouraging');
            
            return {
                success: true,
                message: message,
                partnerReaction: partnerReaction,
                events: [`${playerState.name} struggles with a bite but keeps fighting!`]
            };
        }
    }

    calculateBiteSuccess(playerState) {
        let successChance = 0.7; // Base 70% success rate
        
        // Energy affects success
        if (playerState.energy > 80) successChance += 0.2;
        else if (playerState.energy < 30) successChance -= 0.3;
        
        // Digestion affects success
        if (playerState.digestion > 80) successChance += 0.1;
        else if (playerState.digestion < 30) successChance -= 0.2;
        
        // Mood affects success
        if (playerState.mood === 'excited') successChance += 0.1;
        else if (playerState.mood === 'tired') successChance -= 0.2;
        
        // Food difficulty
        successChance -= (this.gameState.currentFood.difficulty - 1) * 0.1;
        
        return Math.random() < Math.max(0.1, Math.min(0.95, successChance));
    }

    generatePartnerReaction(partner, type) {
        const reactions = {
            impressed: [
                `😍 "${partner.name} watches in awe at your eating prowess!"`,
                `🥰 "Wow babe, you're incredible!" ${partner.name} cheers`,
                `😘 "${partner.name} blows you a kiss, impressed by your skills"`,
                `💕 "That's my champion!" ${partner.name} says proudly`
            ],
            encouraging: [
                `🤗 "${partner.name} gives you an encouraging hug"`,
                `💪 "You got this, babe!" ${partner.name} motivates you`,
                `😊 "${partner.name} smiles supportively at your effort"`,
                `💋 "${partner.name} gives you a quick peck for encouragement"`
            ],
            competitive: [
                `😏 "${partner.name} smirks confidently - the competition is on!"`,
                `🔥 "Game on!" ${partner.name} declares with determination`,
                `😤 "${partner.name} cracks their knuckles - it's serious now"`,
                `⚡ "${partner.name}'s competitive spirit ignites!"`
            ],
            romantic: [
                `💕 "${partner.name} gazes at you lovingly despite the competition"`,
                `🥰 "Even covered in food, you're still cute," ${partner.name} giggles`,
                `😍 "${partner.name} can't help but smile at how adorable you look eating"`,
                `💑 "This is the weirdest but most fun date ever!" ${partner.name} laughs`
            ]
        };
        
        const typeReactions = reactions[type] || reactions.encouraging;
        return typeReactions[Math.floor(Math.random() * typeReactions.length)];
    }

    async useRomanticMove(playerState, partner, moveType) {
        if (playerState.specialMoves <= 0) {
            return { success: false, error: 'No romantic moves left!' };
        }

        playerState.specialMoves--;
        
        const romanticMoves = {
            'feed_partner': {
                effect: () => {
                    partner.energy += 20;
                    playerState.relationshipPoints += 5;
                    partner.relationshipPoints += 5;
                    this.gameState.coupleBonus += 10;
                },
                message: `💕 You lovingly feed ${partner.name} a bite - so romantic! Both of you gain energy and love points!`
            },
            'motivational_speech': {
                effect: () => {
                    partner.energy += 15;
                    partner.mood = 'excited';
                    playerState.relationshipPoints += 3;
                },
                message: `🎤 You give ${partner.name} an inspiring pep talk! "You're amazing and I believe in you!" They feel energized!`
            },
            'sacrifice_turn': {
                effect: () => {
                    partner.currentRoundBites += 2;
                    playerState.relationshipPoints += 8;
                    partner.relationshipPoints += 8;
                },
                message: `😇 You sacrifice your turn to help ${partner.name} eat more! True love wins over competition!`
            },
            'victory_dance': {
                effect: () => {
                    playerState.energy += 25;
                    playerState.mood = 'excited';
                    this.gameState.coupleBonus += 15;
                },
                message: `💃🕺 You both break into a silly victory dance together! Energy restored and love grows stronger!`
            }
        };

        const move = romanticMoves[moveType];
        if (!move) {
            return { success: false, error: 'Unknown romantic move!' };
        }

        move.effect();
        
        this.gameState.romanticMoments.push({
            round: this.gameState.round,
            move: moveType,
            player: playerState.name,
            message: move.message
        });

        return {
            success: true,
            message: move.message,
            romanticBonus: true,
            events: [`${playerState.name} used romantic move: ${moveType}`]
        };
    }

    async checkRoundAdvancement() {
        const player1 = this.gameState.players[0];
        const player2 = this.gameState.players[1];
        
        // Check if both players have eaten enough or are too tired
        const totalBites = player1.currentRoundBites + player2.currentRoundBites;
        const targetBites = this.gameState.currentFood.bites;
        
        if (totalBites >= targetBites || this.gameState.timeRemaining <= 0) {
            await this.endRound();
        }
    }

    async endRound() {
        this.gameState.gamePhase = 'results';
        
        // Calculate round winner
        const player1 = this.gameState.players[0];
        const player2 = this.gameState.players[1];
        
        let roundWinner = null;
        if (player1.currentRoundBites > player2.currentRoundBites) {
            roundWinner = player1;
        } else if (player2.currentRoundBites > player1.currentRoundBites) {
            roundWinner = player2;
        }
        
        // Add round results to events
        this.gameState.events.push({
            type: 'round_end',
            round: this.gameState.round,
            winner: roundWinner?.name || 'Tie',
            bites: {
                [player1.name]: player1.currentRoundBites,
                [player2.name]: player2.currentRoundBites
            },
            timestamp: new Date()
        });
        
        // Reset for next round
        player1.currentRoundBites = 0;
        player2.currentRoundBites = 0;
        
        if (this.gameState.round < this.gameState.maxRounds) {
            this.gameState.round++;
            await this.startPreparationPhase();
        } else {
            await this.endGame();
        }
    }

    async endGame() {
        this.gameState.gamePhase = 'ended';
        
        const player1 = this.gameState.players[0];
        const player2 = this.gameState.players[1];
        
        // Determine overall winner
        let winner = null;
        if (player1.totalBites > player2.totalBites) {
            winner = player1;
        } else if (player2.totalBites > player1.totalBites) {
            winner = player2;
        }
        
        // Generate romantic ending
        const endings = [
            `💕 After an epic eating battle, you both collapse into each other's arms, laughing and covered in food crumbs. Win or lose, love conquered all!`,
            `🥰 "That was amazing!" you both say in unison, then burst into laughter. The real victory was the fun you had together!`,
            `😘 Despite the competition, you end with a sweet kiss. "Same time next week?" your girlfriend asks with a playful grin.`,
            `💑 Exhausted but happy, you snuggle together on the couch. "Best date night ever," you both agree, planning your next food challenge!`
        ];
        
        this.gameState.story.push(endings[Math.floor(Math.random() * endings.length)]);
        this.gameState.winner = winner;
    }

    getDisplayState() {
        const player1 = this.gameState.players[0];
        const player2 = this.gameState.players[1];
        
        let display = `🍽️ **Big Eater Competition - Round ${this.gameState.round}/${this.gameState.maxRounds}**\n\n`;
        
        if (this.gameState.currentFood) {
            display += `📍 **Current Challenge:** ${this.gameState.currentFood.name}\n`;
            display += `📖 *${this.gameState.currentFood.description}*\n`;
            display += `⭐ Difficulty: ${'⭐'.repeat(this.gameState.currentFood.difficulty)}\n\n`;
        }
        
        // Player stats
        display += `👤 **${player1.name}**\n`;
        display += `   🍴 Round Bites: ${player1.currentRoundBites}\n`;
        display += `   🏆 Total Bites: ${player1.totalBites}\n`;
        display += `   ⚡ Energy: ${player1.energy}/100\n`;
        display += `   💗 Mood: ${player1.mood}\n`;
        display += `   💕 Love Points: ${player1.relationshipPoints}\n\n`;
        
        display += `👤 **${player2.name}**\n`;
        display += `   🍴 Round Bites: ${player2.currentRoundBites}\n`;
        display += `   🏆 Total Bites: ${player2.totalBites}\n`;
        display += `   ⚡ Energy: ${player2.energy}/100\n`;
        display += `   💗 Mood: ${player2.mood}\n`;
        display += `   💕 Love Points: ${player2.relationshipPoints}\n\n`;
        
        display += `💑 **Couple Bonus:** ${this.gameState.coupleBonus}\n`;
        display += `🏁 **Phase:** ${this.gameState.gamePhase}\n`;
        
        // Latest story
        if (this.gameState.story.length > 0) {
            display += `\n📖 **Story:** ${this.gameState.story[this.gameState.story.length - 1]}`;
        }
        
        return {
            board: display,
            status: `Round ${this.gameState.round} - ${this.gameState.gamePhase}`,
            gamePhase: this.gameState.gamePhase,
            actions: this.getAvailableActions()
        };
    }

    getAvailableActions() {
        const actions = [];
        
        switch (this.gameState.gamePhase) {
            case 'preparation':
                actions.push('ready');
                break;
                
            case 'eating':
                actions.push('bite', 'power_up', 'sabotage', 'romantic_move');
                break;
                
            case 'results':
                actions.push('continue');
                break;
        }
        
        return actions;
    }

    getValidMoves(userId = null) {
        return this.getAvailableActions();
    }

    checkGameEnd() {
        if (this.gameState.gamePhase === 'ended') {
            return {
                ended: true,
                winner: this.gameState.winner,
                reason: 'completed',
                romanticEnding: true
            };
        }
        
        return { ended: false };
    }

    static getGameInfo() {
        return {
            name: 'Big Eater Competition',
            description: 'Romantic competitive eating game for couples',
            minPlayers: 2,
            maxPlayers: 2,
            estimatedDuration: 20,
            rules: [
                'Compete with your partner in eating challenges',
                'Use power-ups, sabotage, and romantic moves',
                'Balance competition with love and teamwork',
                'Earn relationship points and couple bonuses',
                'Story-driven gameplay with romantic elements'
            ],
            commands: [
                '/bite: Take a bite of food',
                '/powerup <type>: Use a power-up',
                '/romantic <move>: Use romantic special move',
                '/sabotage <type>: Playfully sabotage partner'
            ]
        };
    }
}